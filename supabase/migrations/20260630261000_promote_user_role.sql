-- Promover roles de usuario (solo super_admin)
-- Idempotente.

CREATE OR REPLACE FUNCTION promote_user_role(
  p_user_id UUID,
  p_role faro_user_role
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_old_role TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT role::text INTO v_old_role FROM profiles WHERE id = p_user_id;

  UPDATE profiles
  SET role = p_role,
      status = 'active',
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  PERFORM log_auth_event(
    'role_changed',
    p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role::text)
  );

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION promote_user_role(UUID, faro_user_role) TO authenticated;
