-- FARO: cerrar flujo de solicitudes de rol + auditoria auth en cliente

-- Permiso explícito para auditoría de eventos propios (frontend)
GRANT EXECUTE ON FUNCTION log_own_auth_event(TEXT, JSONB) TO authenticated;

-- Solicitar más información para una solicitud de rol en profiles
CREATE OR REPLACE FUNCTION request_network_role_info(
  p_user_id UUID,
  p_message TEXT
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row profiles%ROWTYPE;
  v_message TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_message := trim(coalesce(p_message, ''));
  IF char_length(v_message) < 8 THEN
    RAISE EXCEPTION 'message_required';
  END IF;

  SELECT * INTO v_row FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_row.role_request_status IS DISTINCT FROM 'pending' OR v_row.pending_role IS NULL THEN
    RAISE EXCEPTION 'no_pending_request';
  END IF;

  UPDATE profiles
  SET role_request_reason = left(v_message, 1000),
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_row;

  PERFORM create_notification(
    p_user_id,
    'Información adicional solicitada',
    left(v_message, 500),
    'network_role_info_request',
    'normal',
    NULL,
    'tab:profile',
    jsonb_build_object(
      'pending_role', v_row.pending_role::text,
      'requested_by', auth.uid()
    ),
    NULL
  );

  PERFORM log_auth_event(
    'network_role_info_requested',
    p_user_id,
    jsonb_build_object('pending_role', v_row.pending_role::text)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION request_network_role_info(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_network_role_info(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION request_network_role_info(UUID, TEXT) TO authenticated;
