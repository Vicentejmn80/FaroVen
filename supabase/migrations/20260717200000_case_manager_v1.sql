-- FARO: Case Manager Experience V1
-- Extiende coordinator_requests para soportar case_manager + under_review status

-- 1) Agregar under_review al enum de estados
ALTER TYPE coordinator_request_status ADD VALUE IF NOT EXISTS 'under_review';

-- 2) Extender coordinator_requests para roles solicitados
ALTER TABLE coordinator_requests
  ADD COLUMN IF NOT EXISTS requested_role TEXT NOT NULL DEFAULT 'coordinator'
    CHECK (requested_role IN ('coordinator', 'case_manager')),
  ADD COLUMN IF NOT EXISTS experience TEXT,
  ADD COLUMN IF NOT EXISTS availability_hours INTEGER;

-- 3) Agregar función para aprobación de rol con auditoría
CREATE OR REPLACE FUNCTION approve_role_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_new_role faro_user_role;
BEGIN
  SELECT * INTO v_request FROM coordinator_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'invalid_request_status';
  END IF;

  v_new_role := v_request.requested_role::faro_user_role;

  -- Actualizar solicitud
  UPDATE coordinator_requests
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = COALESCE(p_review_notes, review_notes)
  WHERE id = p_request_id;

  -- Actualizar perfil del usuario
  UPDATE profiles
  SET
    role = v_new_role,
    pending_role = NULL,
    role_request_status = NULL,
    role_request_reason = NULL,
    role_request_reviewed_at = now(),
    role_request_reviewed_by = p_reviewer_id,
    updated_at = now()
  WHERE id = v_request.auth_user_id;

  -- Crear notificación para el usuario
  PERFORM create_notification(
    v_request.auth_user_id,
    'Solicitud aprobada',
    CASE
      WHEN v_new_role = 'case_manager' THEN 'Tu solicitud para Gestor de Casos ha sido aprobada. Ya puedes acceder al Centro de Operaciones.'
      ELSE 'Tu solicitud para Coordinador ha sido aprobada. Ya puedes gestionar tu centro.'
    END,
    'system',
    'high'
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_role_request(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM coordinator_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'invalid_request_status';
  END IF;

  UPDATE coordinator_requests
  SET
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    review_notes = COALESCE(p_review_notes, review_notes)
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    pending_role = NULL,
    role_request_status = NULL,
    role_request_reason = NULL,
    role_request_reviewed_at = now(),
    role_request_reviewed_by = p_reviewer_id,
    updated_at = now()
  WHERE id = v_request.auth_user_id;

  PERFORM create_notification(
    v_request.auth_user_id,
    'Solicitud no aprobada',
    CASE WHEN p_review_notes IS NOT NULL
      THEN 'Tu solicitud no fue aprobada. Motivo: ' || p_review_notes || '. Puedes volver a intentarlo más tarde.'
      ELSE 'Tu solicitud no fue aprobada en este momento. Puedes volver a intentarlo más tarde.'
    END,
    'system',
    'normal'
  );
END;
$$;

CREATE OR REPLACE FUNCTION mark_role_request_under_review(
  p_request_id UUID,
  p_reviewer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coordinator_requests
  SET
    status = 'under_review',
    reviewed_by = p_reviewer_id
  WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found_or_not_pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_role_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_role_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_role_request_under_review(UUID, UUID) TO authenticated;

-- 4) RLS: permitir lectura de todas las solicitudes a admins y case_managers
DROP POLICY IF EXISTS admins_read_all_requests ON coordinator_requests;
CREATE POLICY admins_read_all_requests ON coordinator_requests
  FOR SELECT TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM profiles WHERE role IN ('super_admin', 'regional_admin', 'case_manager'))
  );
