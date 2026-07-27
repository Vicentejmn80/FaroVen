-- FARO: case_manager puede crear misiones/asignaciones; voluntario puede
-- actualizar la misión a la que está asignado (sync de etapa).
-- También repara aprobaciones approved sin misión (estado parcial por 403).

-- ============================================================
-- 1) RLS: INSERT missions + mission_assignments incluye case_manager
-- ============================================================

DROP POLICY IF EXISTS missions_insert ON public.missions;
CREATE POLICY missions_insert ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

DROP POLICY IF EXISTS mission_assignments_insert ON public.mission_assignments;
CREATE POLICY mission_assignments_insert ON public.mission_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

-- ============================================================
-- 2) RLS: voluntario asignado puede UPDATE missions (advanceMissionStage)
-- ============================================================

DROP POLICY IF EXISTS missions_update ON public.missions;
CREATE POLICY missions_update ON public.missions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.mission_assignments ma
      JOIN public.volunteers v ON v.id = ma.volunteer_id
      WHERE ma.mission_id = missions.id
        AND v.user_id = auth.uid()
        AND ma.status NOT IN ('rejected', 'cancelled')
    )
  );

-- ============================================================
-- 3) Reparar: postulación approved + caso assigned sin misión
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_id UUID;
  m_id UUID;
  created_by_text TEXT;
BEGIN
  FOR r IN
    SELECT
      ca.id AS application_id,
      ca.case_id,
      ca.applicant_id,
      c.title,
      c.description,
      c.priority,
      c.zone,
      COALESCE(c.latitude, 0) AS lat,
      COALESCE(c.longitude, 0) AS lng
    FROM public.case_applications ca
    JOIN public.cases c ON c.id = ca.case_id
    WHERE ca.status = 'approved'
      AND c.pipeline_stage IN ('assigned', 'accepted', 'in_attention')
      AND NOT EXISTS (
        SELECT 1 FROM public.missions m WHERE m.case_id = ca.case_id
      )
  LOOP
    SELECT id INTO v_id FROM public.volunteers WHERE user_id = r.applicant_id LIMIT 1;
    IF v_id IS NULL THEN
      INSERT INTO public.volunteers (user_id, full_name, availability)
      SELECT p.id, COALESCE(p.full_name, 'Voluntario'), 'available'
      FROM public.profiles p
      WHERE p.id = r.applicant_id
      RETURNING id INTO v_id;
    END IF;

    IF v_id IS NULL THEN
      RAISE NOTICE 'Skip repair application %: no volunteer for %', r.application_id, r.applicant_id;
      CONTINUE;
    END IF;

    created_by_text := r.applicant_id::text;

    INSERT INTO public.missions (
      center_id, title, description, priority, required_skills, required_people,
      assigned_people, status, lat, lng, zone, case_id, created_by
    ) VALUES (
      'volunteer_pool',
      r.title,
      COALESCE(r.description, ''),
      COALESCE(r.priority, 'medium'),
      '{}',
      1,
      1,
      'assigned',
      r.lat,
      r.lng,
      COALESCE(r.zone, ''),
      r.case_id,
      created_by_text
    )
    RETURNING id INTO m_id;

    INSERT INTO public.mission_assignments (mission_id, volunteer_id, status)
    SELECT m_id, v_id, 'assigned'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mission_assignments
      WHERE mission_id = m_id AND volunteer_id = v_id
    );

    UPDATE public.public_needs
    SET
      call_status = 'closed',
      visibility_status = 'hidden'
    WHERE case_id = r.case_id
      AND call_status = 'open';

    UPDATE public.case_applications
    SET status = 'rejected'
    WHERE case_id = r.case_id
      AND id <> r.application_id
      AND status IN ('pending', 'under_review');
  END LOOP;
END $$;
