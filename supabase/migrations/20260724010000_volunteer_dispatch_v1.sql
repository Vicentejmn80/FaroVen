-- ÉPICA 10 — Volunteer Dispatch & Mission Lifecycle V1
-- Postulaciones, tracking, timeline extendido

-- ============================================================
-- 1. mission_applications — postulación del voluntario
-- ============================================================
CREATE TABLE IF NOT EXISTS mission_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id        UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  volunteer_id      UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','under_review','approved','rejected','withdrawn','expired')),
  distance_km       DOUBLE PRECISION,
  eta_minutes       INT,
  availability      TEXT,
  notes             TEXT,
  confidence        INT DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  current_lat       DOUBLE PRECISION,
  current_lng       DOUBLE PRECISION,
  application_source TEXT DEFAULT 'manual',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_applications_unique
  ON mission_applications (mission_id, volunteer_id)
  WHERE status NOT IN ('rejected', 'withdrawn', 'expired');

CREATE INDEX IF NOT EXISTS idx_mission_applications_mission
  ON mission_applications (mission_id, status);

CREATE INDEX IF NOT EXISTS idx_mission_applications_volunteer
  ON mission_applications (volunteer_id, status);

ALTER TABLE mission_applications ENABLE ROW LEVEL SECURITY;

-- Voluntarios: crear su propia postulación, ver sus postulaciones
DROP POLICY IF EXISTS ma_volunteer_insert ON mission_applications;
CREATE POLICY ma_volunteer_insert ON mission_applications
  FOR INSERT TO authenticated
  WITH CHECK (volunteer_id = (SELECT id FROM volunteers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ma_volunteer_select ON mission_applications;
CREATE POLICY ma_volunteer_select ON mission_applications
  FOR SELECT TO authenticated
  USING (
    volunteer_id = (SELECT id FROM volunteers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('case_manager','coordinator','regional_admin','super_admin'))
  );

DROP POLICY IF EXISTS ma_volunteer_update ON mission_applications;
CREATE POLICY ma_volunteer_update ON mission_applications
  FOR UPDATE TO authenticated
  USING (status = 'pending' AND volunteer_id = (SELECT id FROM volunteers WHERE user_id = auth.uid()));

-- Gestores/coordinadores: actualizar estado (approve/reject)
DROP POLICY IF EXISTS ma_operator_update ON mission_applications;
CREATE POLICY ma_operator_update ON mission_applications
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('case_manager','coordinator','regional_admin','super_admin')));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mission_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_applications;
  END IF;
END $$;

-- ============================================================
-- 2. Extender mission_assignments con nuevos estados
-- ============================================================
ALTER TABLE mission_assignments
  DROP CONSTRAINT IF EXISTS mission_assignments_status_check;

ALTER TABLE mission_assignments
  ADD CONSTRAINT mission_assignments_status_check
  CHECK (status IN ('assigned','accepted','preparing','en_route','on_site','in_progress','completed','verified','cancelled','archived'));

ALTER TABLE mission_assignments
  ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================================
-- 3. Extender mission_events con nuevos tipos
-- ============================================================
ALTER TABLE mission_events
  DROP CONSTRAINT IF EXISTS mission_events_event_type_check;

ALTER TABLE mission_events
  ADD CONSTRAINT mission_events_event_type_check
  CHECK (event_type IN (
    'mission_created','application_submitted','application_approved','application_rejected',
    'matching_completed','volunteer_assigned','volunteer_accepted','volunteer_preparing',
    'volunteer_rejected','volunteer_en_route','volunteer_on_site','mission_in_progress',
    'mission_completed','mission_verified','mission_cancelled','mission_archived',
    'volunteer_unavailable','needs_info','evidence_submitted'
  ));

-- ============================================================
-- 4. RPC: apply_to_mission
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_to_mission(
  p_mission_id UUID,
  p_volunteer_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission missions%ROWTYPE;
  v_distance DOUBLE PRECISION;
  v_eta INT;
  v_application mission_applications%ROWTYPE;
BEGIN
  -- Validar misión
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Misión no encontrada');
  END IF;

  IF v_mission.status NOT IN ('created', 'matching') THEN
    RETURN jsonb_build_object('error', 'La misión no acepta postulaciones en este estado');
  END IF;

  -- Validar que no exista postulación activa
  IF EXISTS (
    SELECT 1 FROM mission_applications
    WHERE mission_id = p_mission_id
      AND volunteer_id = p_volunteer_id
      AND status NOT IN ('rejected', 'withdrawn', 'expired')
  ) THEN
    RETURN jsonb_build_object('error', 'Ya tienes una postulación activa para esta misión');
  END IF;

  -- Calcular distancia Haversine aproximada
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_mission.lat IS NOT NULL AND v_mission.lng IS NOT NULL THEN
    v_distance := 6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_mission.lat - p_lat) / 2), 2) +
      COS(RADIANS(p_lat)) * COS(RADIANS(v_mission.lat)) *
      POWER(SIN(RADIANS(v_mission.lng - p_lng) / 2), 2)
    ));
    v_eta := (v_distance / 30 * 60)::INT;
  END IF;

  INSERT INTO mission_applications (
    mission_id, volunteer_id, status, notes,
    current_lat, current_lng, distance_km, eta_minutes
  ) VALUES (
    p_mission_id, p_volunteer_id, 'pending', p_notes,
    p_lat, p_lng, v_distance, v_eta
  )
  RETURNING * INTO v_application;

  INSERT INTO mission_events (mission_id, event_type, actor_id, description, metadata)
  VALUES (
    p_mission_id, 'application_submitted',
    (SELECT user_id::text FROM volunteers WHERE id = p_volunteer_id),
    'Voluntario postulado',
    jsonb_build_object('application_id', v_application.id, 'volunteer_id', p_volunteer_id)
  );

  RETURN jsonb_build_object('id', v_application.id, 'status', 'pending', 'distance_km', v_distance, 'eta_minutes', v_eta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_mission TO authenticated;

-- ============================================================
-- 5. RPC: approve_application
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_application(
  p_application_id UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app mission_applications%ROWTYPE;
  v_assignment_id UUID;
BEGIN
  SELECT * INTO v_app FROM mission_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Postulación no encontrada');
  END IF;

  IF v_app.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Solo se pueden aprobar postulaciones pendientes');
  END IF;

  UPDATE mission_applications
  SET status = 'approved', updated_at = now()
  WHERE id = p_application_id;

  -- Crear asignación
  INSERT INTO mission_assignments (mission_id, volunteer_id, status)
  VALUES (v_app.mission_id, v_app.volunteer_id, 'assigned')
  RETURNING id INTO v_assignment_id;

  -- Actualizar misión
  UPDATE missions
  SET status = 'assigned', assigned_people = assigned_people + 1, updated_at = now()
  WHERE id = v_app.mission_id;

  -- Evento
  INSERT INTO mission_events (mission_id, event_type, actor_id, description, metadata)
  VALUES (
    v_app.mission_id, 'application_approved', p_operator_id::text,
    'Gestor aprobó postulación',
    jsonb_build_object('application_id', p_application_id, 'assignment_id', v_assignment_id)
  );

  RETURN jsonb_build_object('assignment_id', v_assignment_id, 'status', 'assigned');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_application TO authenticated;

-- ============================================================
-- 6. RPC: reject_application
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_application(
  p_application_id UUID,
  p_operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app mission_applications%ROWTYPE;
BEGIN
  SELECT * INTO v_app FROM mission_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Postulación no encontrada');
  END IF;

  UPDATE mission_applications
  SET status = 'rejected', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO mission_events (mission_id, event_type, actor_id, description, metadata)
  VALUES (
    v_app.mission_id, 'application_rejected', p_operator_id::text,
    'Gestor rechazó postulación',
    jsonb_build_object('application_id', p_application_id)
  );

  RETURN jsonb_build_object('status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_application TO authenticated;

-- ============================================================
-- 7. RPC: update_volunteer_location
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_volunteer_location(
  p_user_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE volunteers
  SET lat = p_lat, lng = p_lng, last_location_update = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_volunteer_location TO authenticated;

-- ============================================================
-- 8. Extender volunteers con más métricas
-- ============================================================
ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avg_mission_duration_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS centers_collaborated TEXT[] DEFAULT '{}';
