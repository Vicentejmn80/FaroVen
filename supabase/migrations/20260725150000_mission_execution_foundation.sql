-- Épica 10 · Fase 1 — Cimientos del Mission Execution Engine
--
-- El motor de ejecución (missions + mission_assignments + mission_events) ya
-- existía, pero fallaba en silencio por desalineaciones entre el dominio y el
-- esquema. Esta migración cierra esas brechas y añade el destino operacional.

-- ============================================================
-- 1. missions.status admite 'cancelled'
--    El dominio permite cancelar (VALID_MISSION_TRANSITIONS) pero el CHECK
--    original no incluía el valor, así que cancelar reventaba el update.
-- ============================================================
ALTER TABLE missions
  DROP CONSTRAINT IF EXISTS missions_status_check;

ALTER TABLE missions
  ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'created','matching','assigned','accepted','en_route','on_site',
    'in_progress','completed','verified','cancelled','archived'
  ));

-- ============================================================
-- 2. mission_assignments.status recupera 'rejected'
--    La migración de dispatch lo eliminó del CHECK, dejando
--    rejectAssignment() imposible de ejecutar.
-- ============================================================
ALTER TABLE mission_assignments
  DROP CONSTRAINT IF EXISTS mission_assignments_status_check;

ALTER TABLE mission_assignments
  ADD CONSTRAINT mission_assignments_status_check
  CHECK (status IN (
    'assigned','accepted','rejected','preparing','en_route','on_site',
    'in_progress','completed','verified','cancelled','archived'
  ));

-- Consulta caliente: misiones activas de un voluntario
CREATE INDEX IF NOT EXISTS idx_mission_assignments_volunteer_status
  ON mission_assignments (volunteer_id, status);

-- ============================================================
-- 3. success_cases sin necesidad pública obligatoria
--    Una misión puede nacer de un caso sin public_need asociada; el NOT NULL
--    hacía fallar todos los inserts de casos de éxito.
-- ============================================================
ALTER TABLE success_cases
  ALTER COLUMN public_need_id DROP NOT NULL;

ALTER TABLE success_cases
  ADD COLUMN IF NOT EXISTS volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS response_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'humanitarian';

CREATE INDEX IF NOT EXISTS idx_success_cases_verified_at
  ON success_cases (verified_at DESC);

-- ============================================================
-- 4. Destino operacional de una necesidad pública
--    Reglas logísticas: no toda necesidad admite voluntarios.
-- ============================================================
ALTER TABLE public_needs
  ADD COLUMN IF NOT EXISTS operational_destination TEXT NOT NULL DEFAULT 'public_call',
  ADD COLUMN IF NOT EXISTS institution_type TEXT,
  ADD COLUMN IF NOT EXISTS institution_name TEXT;

ALTER TABLE public_needs
  DROP CONSTRAINT IF EXISTS public_needs_operational_destination_check;

ALTER TABLE public_needs
  ADD CONSTRAINT public_needs_operational_destination_check
  CHECK (operational_destination IN ('public_call','institution','both'));

ALTER TABLE public_needs
  DROP CONSTRAINT IF EXISTS public_needs_institution_type_check;

ALTER TABLE public_needs
  ADD CONSTRAINT public_needs_institution_type_check
  CHECK (institution_type IS NULL OR institution_type IN (
    'civil_protection','firefighters','hospital','city_hall','ngo','police','other'
  ));

COMMENT ON COLUMN public_needs.operational_destination IS
  'public_call = convocatoria abierta a voluntarios; institution = solo derivación institucional; both = ambas vías';

-- ============================================================
-- 5. ensure_volunteer_profile — puente profiles → volunteers
--    mission_assignments.volunteer_id referencia volunteers(id), pero las
--    postulaciones a casos guardan un profiles(id). Aprobar una postulación
--    violaba la FK y la asignación nunca se creaba: ahí moría el flujo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_volunteer_profile(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_volunteer_id UUID;
  v_full_name TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ensure_volunteer_profile: p_user_id es obligatorio';
  END IF;

  -- Solo uno mismo o un operador puede materializar el perfil de voluntario.
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager','coordinator','regional_admin','super_admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id INTO v_volunteer_id FROM volunteers WHERE user_id = p_user_id;
  IF v_volunteer_id IS NOT NULL THEN
    RETURN v_volunteer_id;
  END IF;

  SELECT NULLIF(full_name, '') INTO v_full_name
  FROM profiles WHERE id = p_user_id;

  INSERT INTO volunteers (user_id, full_name, availability)
  VALUES (p_user_id, COALESCE(v_full_name, 'Colaborador'), 'available')
  RETURNING id INTO v_volunteer_id;

  RETURN v_volunteer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_volunteer_profile(UUID) TO authenticated;

-- ============================================================
-- 6. Backfill: asignaciones huérfanas de postulaciones aprobadas
--    Recupera los casos ya aprobados que se quedaron sin asignación.
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_volunteer_id UUID;
BEGIN
  FOR r IN
    SELECT ca.applicant_id, m.id AS mission_id
    FROM case_applications ca
    JOIN missions m ON m.case_id = ca.case_id
    WHERE ca.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM mission_assignments ma WHERE ma.mission_id = m.id
      )
  LOOP
    v_volunteer_id := public.ensure_volunteer_profile(r.applicant_id);
    INSERT INTO mission_assignments (mission_id, volunteer_id, status)
    VALUES (r.mission_id, v_volunteer_id, 'assigned')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
