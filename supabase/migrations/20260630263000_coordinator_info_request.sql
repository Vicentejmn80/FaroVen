-- Solicitud de más información in-app (admin → solicitante → respuesta)
-- Idempotente.

ALTER TABLE coordinator_requests
  ADD COLUMN IF NOT EXISTS info_request_message TEXT,
  ADD COLUMN IF NOT EXISTS info_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS info_response TEXT,
  ADD COLUMN IF NOT EXISTS info_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_info_response BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'coordinator_info_request',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_request_id UUID REFERENCES coordinator_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON user_notifications(user_id, status, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notifications_select_own ON user_notifications;
CREATE POLICY user_notifications_select_own ON user_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_notifications_update_own ON user_notifications;
CREATE POLICY user_notifications_update_own ON user_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON user_notifications TO authenticated;

-- Admin solicita más información → notificación al solicitante
CREATE OR REPLACE FUNCTION request_coordinator_info(
  p_request_id UUID,
  p_message TEXT
)
RETURNS coordinator_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_center_name TEXT := 'tu centro';
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF coalesce(trim(p_message), '') = '' THEN
    RAISE EXCEPTION 'message_required';
  END IF;

  UPDATE coordinator_requests
  SET info_request_message = trim(p_message),
      info_requested_at = now(),
      needs_info_response = true,
      updated_at = now()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found_or_not_pending';
  END IF;

  IF v_request.requested_site_type = 'hospital' THEN
    SELECT name INTO v_center_name FROM hospitals WHERE id = v_request.requested_site_id;
  ELSIF v_request.requested_site_type = 'shelter' THEN
    SELECT name INTO v_center_name FROM shelters WHERE id = v_request.requested_site_id;
  ELSIF v_request.requested_site_type = 'supply_center' THEN
    SELECT name INTO v_center_name FROM supply_centers WHERE id = v_request.requested_site_id;
  END IF;

  IF v_request.auth_user_id IS NOT NULL THEN
    INSERT INTO user_notifications (
      user_id,
      type,
      title,
      body,
      payload,
      related_request_id
    ) VALUES (
      v_request.auth_user_id,
      'coordinator_info_request',
      'Necesitamos más información',
      'Un administrador revisó tu solicitud para ' || coalesce(v_center_name, 'un centro') || '.',
      jsonb_build_object(
        'admin_message', trim(p_message),
        'center_name', v_center_name,
        'request_id', v_request.id
      ),
      v_request.id
    );
  END IF;

  RETURN v_request;
END;
$$;

-- Solicitante responde con información adicional
CREATE OR REPLACE FUNCTION respond_coordinator_info(
  p_request_id UUID,
  p_response TEXT
)
RETURNS coordinator_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_admin RECORD;
BEGIN
  IF coalesce(trim(p_response), '') = '' THEN
    RAISE EXCEPTION 'response_required';
  END IF;

  UPDATE coordinator_requests
  SET info_response = trim(p_response),
      info_responded_at = now(),
      needs_info_response = false,
      reason = coalesce(reason, '') || E'\n\n--- Información adicional ---\n' || trim(p_response),
      updated_at = now()
  WHERE id = p_request_id
    AND status = 'pending'
    AND needs_info_response = true
    AND (
      auth_user_id = auth.uid()
      OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found_or_not_allowed';
  END IF;

  UPDATE user_notifications
  SET status = 'read'
  WHERE related_request_id = p_request_id
    AND user_id = auth.uid()
    AND status = 'unread';

  FOR v_admin IN
    SELECT id FROM profiles
    WHERE role IN ('regional_admin', 'super_admin')
      AND status = 'active'
  LOOP
    INSERT INTO admin_notifications (
      user_id,
      type,
      title,
      body,
      payload,
      related_request_id
    ) VALUES (
      v_admin.id,
      'coordinator_info_response',
      'Respuesta del solicitante',
      v_request.full_name || ' amplió su solicitud de coordinador.',
      jsonb_build_object(
        'applicant_name', v_request.full_name,
        'applicant_email', v_request.email,
        'request_id', v_request.id
      ),
      v_request.id
    );
  END LOOP;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION request_coordinator_info(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_coordinator_info(UUID, TEXT) TO authenticated;
