-- FARO — P0 Security Remediation: Critical fixes only
-- C-01: Prevent profile role escalation
-- C-02: Block coordinator_profiles self-assignment
-- C-04: Revoke notify_coordinator_request_user from authenticated
-- C-05: Revoke log_auth_event from authenticated

-- ============================================================
-- C-01: Prevent profile role/status self-escalation
-- ============================================================
CREATE OR REPLACE FUNCTION guard_profile_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'status_change_forbidden';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role_changes ON profiles;
CREATE TRIGGER trg_guard_profile_role_changes
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_role_changes();

-- ============================================================
-- C-02: Block coordinator_profiles self-assignment
-- ============================================================
DROP POLICY IF EXISTS coordinator_profiles_insert_own ON coordinator_profiles;
DROP POLICY IF EXISTS coordinator_profiles_update_own ON coordinator_profiles;

DROP POLICY IF EXISTS coordinator_profiles_admin_insert ON coordinator_profiles;
CREATE POLICY coordinator_profiles_admin_insert ON coordinator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());

DROP POLICY IF EXISTS coordinator_profiles_admin_update ON coordinator_profiles;
CREATE POLICY coordinator_profiles_admin_update ON coordinator_profiles
  FOR UPDATE TO authenticated
  USING (is_elevated_admin())
  WITH CHECK (is_elevated_admin());

-- ============================================================
-- C-04: Restrict notify_coordinator_request_user
-- ============================================================
REVOKE EXECUTE ON FUNCTION notify_coordinator_request_user(
  UUID, TEXT, TEXT, TEXT, JSONB, UUID
) FROM authenticated;

-- ============================================================
-- C-05: Restrict log_auth_event
-- ============================================================
REVOKE EXECUTE ON FUNCTION log_auth_event(TEXT, UUID, JSONB) FROM authenticated;
