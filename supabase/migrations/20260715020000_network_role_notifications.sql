-- Notificaciones internas para solicitudes de rol de Red de Apoyo
-- Idempotente.

CREATE OR REPLACE FUNCTION notify_admins_network_role_request(
  p_requester_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_requested_role TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_label TEXT := coalesce(p_full_name, p_email, 'Usuario desconocido');
BEGIN
  FOR v_admin IN
    SELECT id FROM profiles
    WHERE status = 'active' AND role IN ('regional_admin', 'super_admin')
  LOOP
    INSERT INTO admin_notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_admin.id,
      'network_role_request',
      'Nueva solicitud de rol',
      v_label || ' solicita el rol ' || p_requested_role || '.',
      jsonb_build_object(
        'applicant_name', p_full_name,
        'applicant_email', p_email,
        'requested_role', p_requested_role,
        'reason', p_reason,
        'user_id', p_requester_id
      )
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION notify_admins_network_role_request(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION request_network_role(
  p_role TEXT,
  p_reason TEXT
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row profiles%ROWTYPE;
  v_reason TEXT;
  v_pending faro_user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_role NOT IN ('case_manager', 'coordinator') THEN
    RAISE EXCEPTION 'invalid_requested_role';
  END IF;

  v_reason := trim(coalesce(p_reason, ''));
  IF char_length(v_reason) < 12 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;
  IF char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'reason_too_long';
  END IF;

  v_pending := p_role::faro_user_role;

  SELECT * INTO v_row FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_row.status = 'suspended' THEN
    RAISE EXCEPTION 'account_suspended';
  END IF;

  IF v_row.role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin') THEN
    RAISE EXCEPTION 'role_already_assigned';
  END IF;

  IF v_row.role_request_status = 'pending' THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  PERFORM set_config('faro.allow_role_bootstrap', 'on', true);

  UPDATE profiles
  SET
    role = 'volunteer',
    status = 'active',
    network_role_selected_at = COALESCE(network_role_selected_at, now()),
    pending_role = v_pending,
    role_request_reason = v_reason,
    role_request_status = 'pending',
    role_request_reviewed_at = NULL,
    role_request_reviewed_by = NULL,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  PERFORM log_auth_event(
    'network_role_requested',
    auth.uid(),
    jsonb_build_object('pending_role', p_role, 'reason', left(v_reason, 200))
  );

  PERFORM notify_elevated_admins(
    'network_role_request',
    'Nueva solicitud de rol',
    coalesce(v_row.full_name, v_row.email) || ' solicita: ' || p_role,
    'high',
    'user-plus',
    'tab:admin',
    jsonb_build_object(
      'user_id', v_row.id,
      'pending_role', p_role
    ),
    false
  );

  PERFORM notify_admins_network_role_request(
    auth.uid(),
    coalesce(v_row.full_name, v_row.email),
    v_row.email,
    p_role,
    v_reason
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION request_network_role(TEXT, TEXT) TO authenticated;

