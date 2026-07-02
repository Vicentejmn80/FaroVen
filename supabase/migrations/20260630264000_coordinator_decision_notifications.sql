-- Notificar al solicitante cuando su solicitud es aprobada o rechazada
-- Idempotente.

CREATE OR REPLACE FUNCTION coordinator_request_center_name(
  p_site_type TEXT,
  p_site_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF p_site_type = 'hospital' THEN
    SELECT name INTO v_name FROM hospitals WHERE id = p_site_id;
  ELSIF p_site_type = 'shelter' THEN
    SELECT name INTO v_name FROM shelters WHERE id = p_site_id;
  ELSIF p_site_type = 'supply_center' THEN
    SELECT name INTO v_name FROM supply_centers WHERE id = p_site_id;
  END IF;
  RETURN coalesce(v_name, 'tu centro');
END;
$$;

CREATE OR REPLACE FUNCTION coordinator_request_user_id(p_request coordinator_requests)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := p_request.auth_user_id;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_request.email)
    LIMIT 1;
  END IF;
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION notify_coordinator_request_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload JSONB,
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO user_notifications (
    user_id,
    type,
    title,
    body,
    payload,
    related_request_id
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_body,
    coalesce(p_payload, '{}'::jsonb),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION approve_coordinator_request(
  p_request_id UUID,
  p_assigned_site_type TEXT,
  p_assigned_site_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS coordinator_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_user_id UUID;
  v_center_name TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_request
  FROM coordinator_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  v_user_id := coordinator_request_user_id(v_request);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found_for_request';
  END IF;

  UPDATE coordinator_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      assigned_site_type = p_assigned_site_type,
      assigned_site_id = p_assigned_site_id,
      review_notes = p_review_notes,
      needs_info_response = false,
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (v_user_id, v_request.email, v_request.full_name, 'coordinator', 'active')
  ON CONFLICT (id) DO UPDATE
    SET role = 'coordinator',
        full_name = EXCLUDED.full_name,
        status = 'active',
        updated_at = now();

  INSERT INTO coordinator_profiles (
    auth_user_id,
    site_type,
    site_id,
    full_name,
    phone,
    role_title,
    organization,
    onboarding_complete,
    updated_at
  )
  VALUES (
    v_user_id,
    p_assigned_site_type,
    p_assigned_site_id,
    v_request.full_name,
    v_request.phone,
    v_request.role_title,
    v_request.organization,
    true,
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET site_type = EXCLUDED.site_type,
        site_id = EXCLUDED.site_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role_title = EXCLUDED.role_title,
        organization = EXCLUDED.organization,
        onboarding_complete = true,
        updated_at = now();

  PERFORM log_auth_event(
    'coordinator_request_approved',
    v_user_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id
    )
  );

  v_center_name := coordinator_request_center_name(p_assigned_site_type, p_assigned_site_id);

  PERFORM notify_coordinator_request_user(
    v_user_id,
    'coordinator_request_approved',
    'Solicitud aprobada',
    'Ahora eres coordinador de ' || v_center_name || '.',
    jsonb_build_object(
      'center_name', v_center_name,
      'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id,
      'request_id', v_request.id
    ),
    v_request.id
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION reject_coordinator_request(
  p_request_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS coordinator_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_user_id UUID;
  v_center_name TEXT;
  v_body TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE coordinator_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes,
      needs_info_response = false,
      updated_at = now()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found_or_not_pending';
  END IF;

  v_user_id := coordinator_request_user_id(v_request);

  PERFORM log_auth_event(
    'coordinator_request_rejected',
    v_user_id,
    jsonb_build_object('request_id', p_request_id)
  );

  v_center_name := coordinator_request_center_name(
    coalesce(v_request.assigned_site_type, v_request.requested_site_type),
    coalesce(v_request.assigned_site_id, v_request.requested_site_id)
  );

  v_body := 'Tu solicitud para coordinar ' || v_center_name || ' fue rechazada por un administrador.';
  IF coalesce(trim(p_review_notes), '') <> '' THEN
    v_body := v_body || ' Motivo: ' || trim(p_review_notes);
  END IF;

  PERFORM notify_coordinator_request_user(
    v_user_id,
    'coordinator_request_rejected',
    'Solicitud rechazada',
    v_body,
    jsonb_build_object(
      'center_name', v_center_name,
      'review_notes', p_review_notes,
      'request_id', v_request.id
    ),
    v_request.id
  );

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION coordinator_request_center_name(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_coordinator_request_user(UUID, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;
