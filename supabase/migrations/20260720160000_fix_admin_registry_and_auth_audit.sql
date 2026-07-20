-- Fix PostgREST 400 on admin_registry_overview (varchar vs text)
-- and restore safe client-side auth audit logging after P0 revoke.

-- ============================================================
-- 1. admin_registry_overview — cast all TEXT columns explicitly
-- ============================================================
CREATE OR REPLACE FUNCTION admin_registry_overview()
RETURNS TABLE (
  site_type TEXT,
  site_id UUID,
  site_name TEXT,
  site_address TEXT,
  profile_id UUID,
  auth_user_id UUID,
  coordinator_email TEXT,
  coordinator_name TEXT,
  is_orphan BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    'hospital'::TEXT,
    h.id,
    h.name::TEXT,
    h.address::TEXT,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name::TEXT,
    (cp.id IS NULL)
  FROM hospitals h
  LEFT JOIN coordinator_profiles cp
    ON cp.site_type = 'hospital' AND cp.site_id = h.id
  LEFT JOIN auth.users au ON au.id = cp.auth_user_id

  UNION ALL

  SELECT
    'shelter'::TEXT,
    s.id,
    s.name::TEXT,
    s.address::TEXT,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name::TEXT,
    (cp.id IS NULL)
  FROM shelters s
  LEFT JOIN coordinator_profiles cp
    ON cp.site_type = 'shelter' AND cp.site_id = s.id
  LEFT JOIN auth.users au ON au.id = cp.auth_user_id

  UNION ALL

  SELECT
    'supply_center'::TEXT,
    sc.id,
    sc.name::TEXT,
    sc.address::TEXT,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name::TEXT,
    (cp.id IS NULL)
  FROM supply_centers sc
  LEFT JOIN coordinator_profiles cp
    ON cp.site_type = 'supply_center' AND cp.site_id = sc.id
  LEFT JOIN auth.users au ON au.id = cp.auth_user_id

  ORDER BY 7 DESC, 3 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_registry_overview() TO authenticated;

-- ============================================================
-- 2. Client-safe auth audit (own events only, action whitelist)
-- ============================================================
CREATE OR REPLACE FUNCTION log_own_auth_event(
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_action NOT IN ('login', 'logout', 'user_created', 'email_confirmed') THEN
    RAISE EXCEPTION 'invalid_auth_action';
  END IF;

  INSERT INTO auth_audit_logs (actor_user_id, action, target_user_id, metadata)
  VALUES (v_uid, p_action, v_uid, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION log_own_auth_event(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION log_own_auth_event(TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION log_own_auth_event(TEXT, JSONB) TO authenticated;

-- Keep privileged log_auth_event for SECURITY DEFINER callers only
REVOKE ALL ON FUNCTION log_auth_event(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION log_auth_event(TEXT, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION log_auth_event(TEXT, UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION log_auth_event(TEXT, UUID, JSONB) TO postgres, service_role;

REVOKE ALL ON FUNCTION admin_registry_overview() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_registry_overview() FROM anon;
GRANT EXECUTE ON FUNCTION admin_registry_overview() TO authenticated;
