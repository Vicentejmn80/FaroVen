-- Super admin puede reasignar coordinador en un centro ya ocupado.

CREATE OR REPLACE FUNCTION assign_coordinator_role(
  p_user_id UUID,
  p_site_type TEXT,
  p_site_id UUID
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_center_name TEXT;
  v_existing UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_site_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_site_type';
  END IF;

  IF p_site_type = 'hospital' THEN
    SELECT name INTO v_center_name FROM hospitals WHERE id = p_site_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'site_not_found'; END IF;
  ELSIF p_site_type = 'shelter' THEN
    SELECT name INTO v_center_name FROM shelters WHERE id = p_site_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'site_not_found'; END IF;
  ELSE
    SELECT name INTO v_center_name FROM supply_centers WHERE id = p_site_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'site_not_found'; END IF;
  END IF;

  SELECT auth_user_id INTO v_existing
  FROM coordinator_profiles
  WHERE site_type = p_site_type
    AND site_id = p_site_id
    AND auth_user_id IS DISTINCT FROM p_user_id
  LIMIT 1;

  -- Reemplazar coordinador anterior en ese centro (solo super admin)
  IF v_existing IS NOT NULL THEN
    DELETE FROM coordinator_profiles WHERE auth_user_id = v_existing;
    UPDATE profiles
    SET role = NULL,
        updated_at = now()
    WHERE id = v_existing
      AND role = 'coordinator';

    PERFORM log_auth_event(
      'coordinator_revoked',
      v_existing,
      jsonb_build_object(
        'reason', 'replaced_by_super_admin',
        'new_user_id', p_user_id,
        'site_type', p_site_type,
        'site_id', p_site_id
      )
    );
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  UPDATE profiles
  SET role = 'coordinator',
      status = 'active',
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  INSERT INTO coordinator_profiles (
    auth_user_id,
    site_type,
    site_id,
    full_name,
    onboarding_complete,
    updated_at
  )
  VALUES (
    p_user_id,
    p_site_type,
    p_site_id,
    v_profile.full_name,
    true,
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET site_type = EXCLUDED.site_type,
        site_id = EXCLUDED.site_id,
        full_name = EXCLUDED.full_name,
        onboarding_complete = true,
        updated_at = now();

  PERFORM log_auth_event(
    'coordinator_assigned',
    p_user_id,
    jsonb_build_object(
      'site_type', p_site_type,
      'site_id', p_site_id,
      'center_name', v_center_name,
      'replaced_previous', v_existing IS NOT NULL
    )
  );

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_coordinator_role(UUID, TEXT, UUID) TO authenticated, anon;
