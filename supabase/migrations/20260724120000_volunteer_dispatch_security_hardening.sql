-- ÉPICA 10 · Fase 12 — Security hardening for dispatch RPCs
-- Valida roles de operador y ownership del voluntario en SECURITY DEFINER RPCs.

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
  v_caller_volunteer_id UUID;
BEGIN
  SELECT id INTO v_caller_volunteer_id
  FROM volunteers
  WHERE user_id = auth.uid();

  IF v_caller_volunteer_id IS NULL OR v_caller_volunteer_id IS DISTINCT FROM p_volunteer_id THEN
    RETURN jsonb_build_object('error', 'No autorizado: solo puedes postularte con tu propio perfil de voluntario');
  END IF;

  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Misión no encontrada');
  END IF;

  IF v_mission.status NOT IN ('created', 'matching') THEN
    RETURN jsonb_build_object('error', 'La misión no acepta postulaciones en este estado');
  END IF;

  IF EXISTS (
    SELECT 1 FROM mission_applications
    WHERE mission_id = p_mission_id
      AND volunteer_id = p_volunteer_id
      AND status NOT IN ('rejected', 'withdrawn', 'expired')
  ) THEN
    RETURN jsonb_build_object('error', 'Ya tienes una postulación activa para esta misión');
  END IF;

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
    auth.uid()::text,
    'Voluntario postulado',
    jsonb_build_object('application_id', v_application.id, 'volunteer_id', p_volunteer_id, 'distance_km', v_distance)
  );

  RETURN jsonb_build_object('id', v_application.id, 'status', 'pending', 'distance_km', v_distance, 'eta_minutes', v_eta);
END;
$$;

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
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_operator_id THEN
    RETURN jsonb_build_object('error', 'No autorizado: el operador debe coincidir con la sesión activa');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('error', 'No autorizado: se requiere rol de gestor u operador');
  END IF;

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

  INSERT INTO mission_assignments (mission_id, volunteer_id, status)
  VALUES (v_app.mission_id, v_app.volunteer_id, 'assigned')
  RETURNING id INTO v_assignment_id;

  UPDATE missions
  SET status = 'assigned', assigned_people = assigned_people + 1, updated_at = now()
  WHERE id = v_app.mission_id;

  INSERT INTO mission_events (mission_id, event_type, actor_id, description, metadata)
  VALUES (
    v_app.mission_id, 'application_approved', p_operator_id::text,
    'Gestor aprobó postulación',
    jsonb_build_object(
      'application_id', p_application_id,
      'assignment_id', v_assignment_id,
      'volunteer_id', v_app.volunteer_id,
      'distance_km', v_app.distance_km
    )
  );

  RETURN jsonb_build_object('assignment_id', v_assignment_id, 'status', 'assigned');
END;
$$;

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
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_operator_id THEN
    RETURN jsonb_build_object('error', 'No autorizado: el operador debe coincidir con la sesión activa');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('error', 'No autorizado: se requiere rol de gestor u operador');
  END IF;

  SELECT * INTO v_app FROM mission_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Postulación no encontrada');
  END IF;

  IF v_app.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Solo se pueden rechazar postulaciones pendientes');
  END IF;

  UPDATE mission_applications
  SET status = 'rejected', updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO mission_events (mission_id, event_type, actor_id, description, metadata)
  VALUES (
    v_app.mission_id, 'application_rejected', p_operator_id::text,
    'Gestor rechazó postulación',
    jsonb_build_object(
      'application_id', p_application_id,
      'volunteer_id', v_app.volunteer_id,
      'distance_km', v_app.distance_km
    )
  );

  RETURN jsonb_build_object('status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_mission TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_application TO authenticated;

-- ============================================================
-- RLS SELECT: voluntario propio; case_manager / coordinator / admins
-- ============================================================
DROP POLICY IF EXISTS ma_volunteer_select ON mission_applications;

CREATE POLICY ma_volunteer_select ON mission_applications
  FOR SELECT TO authenticated
  USING (
    volunteer_id = (SELECT id FROM volunteers WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS ma_operator_update ON mission_applications;

CREATE POLICY ma_operator_update ON mission_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );
