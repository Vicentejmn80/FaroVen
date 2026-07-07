-- FARO — High Severity Remediation A-03
-- Prevent approve_coordinator_request from downgrading admin roles.

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

  -- A-02: ensure assigned site exists and type is valid
  PERFORM assert_valid_site_reference(p_assigned_site_type, p_assigned_site_id);

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
    SET role = CASE
        WHEN profiles.role IN ('regional_admin', 'super_admin') THEN profiles.role
        ELSE 'coordinator'
      END,
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
