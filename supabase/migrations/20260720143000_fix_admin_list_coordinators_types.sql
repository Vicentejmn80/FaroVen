-- Fix PostgREST 400: admin_list_coordinators return types must match exactly (varchar → text casts).

CREATE OR REPLACE FUNCTION admin_list_coordinators()
RETURNS TABLE (
  profile_id UUID,
  auth_user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  site_type TEXT,
  site_id UUID,
  site_name TEXT,
  user_status TEXT,
  user_role TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.auth_user_id,
    cp.full_name::text,
    p.email::text,
    COALESCE(cp.phone, p.phone)::text,
    cp.site_type::text,
    cp.site_id,
    CASE cp.site_type
      WHEN 'hospital' THEN (SELECT h.name::text FROM hospitals h WHERE h.id = cp.site_id)
      WHEN 'shelter' THEN (SELECT s.name::text FROM shelters s WHERE s.id = cp.site_id)
      ELSE (SELECT sc.name::text FROM supply_centers sc WHERE sc.id = cp.site_id)
    END,
    p.status::text,
    p.role::text,
    cp.updated_at
  FROM coordinator_profiles cp
  JOIN profiles p ON p.id = cp.auth_user_id
  ORDER BY cp.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_coordinators() TO authenticated, anon;
