-- Admin bootstrap (Vicente) + borrado seguro de sitios/coordinadores huérfanos.

-- ============================================================
-- 1. Administrador principal
-- ============================================================
INSERT INTO admin_emails (email, note)
VALUES ('vicentejmn80@gmail.com', 'Admin principal FARO')
ON CONFLICT (email) DO NOTHING;

-- Opcional: quitar admin bootstrap anterior
-- DELETE FROM admin_emails WHERE email = 'nex.gen0211@gmail.com';

-- ============================================================
-- 2. Admin puede leer todos los perfiles de coordinador
-- ============================================================
DROP POLICY IF EXISTS admin_read_coordinator_profiles ON coordinator_profiles;
CREATE POLICY admin_read_coordinator_profiles
  ON coordinator_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_delete_coordinator_profiles ON coordinator_profiles;
CREATE POLICY admin_delete_coordinator_profiles
  ON coordinator_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

GRANT DELETE ON coordinator_profiles TO authenticated;

-- ============================================================
-- 3. Admin puede borrar sitios y necesidades asociadas
-- ============================================================
DROP POLICY IF EXISTS admin_delete_hospitals ON hospitals;
CREATE POLICY admin_delete_hospitals
  ON hospitals FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_delete_shelters ON shelters;
CREATE POLICY admin_delete_shelters
  ON shelters FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_delete_supply_centers ON supply_centers;
CREATE POLICY admin_delete_supply_centers
  ON supply_centers FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS admin_delete_needs ON needs;
CREATE POLICY admin_delete_needs
  ON needs FOR DELETE
  TO authenticated
  USING (is_admin());

GRANT DELETE ON hospitals, shelters, supply_centers, needs TO authenticated;

-- ============================================================
-- 4. Vista unificada de sitios + coordinador (solo admin)
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
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    'hospital'::TEXT,
    h.id,
    h.name::TEXT,
    h.address,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name,
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
    s.address,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name,
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
    sc.address,
    cp.id,
    cp.auth_user_id,
    au.email::TEXT,
    cp.full_name,
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
-- 5. Borrado seguro de un sitio (needs, perfil, sitio)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_site(p_site_type TEXT, p_site_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  IF p_site_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'site_type inválido: %', p_site_type;
  END IF;

  DELETE FROM needs
  WHERE needable_type = p_site_type AND needable_id = p_site_id;

  DELETE FROM coordinator_profiles
  WHERE site_type = p_site_type AND site_id = p_site_id;

  IF p_site_type = 'hospital' THEN
    UPDATE persons SET hospital_id = NULL WHERE hospital_id = p_site_id;
    DELETE FROM hospitals WHERE id = p_site_id;
  ELSIF p_site_type = 'shelter' THEN
    UPDATE persons SET shelter_id = NULL WHERE shelter_id = p_site_id;
    DELETE FROM shelters WHERE id = p_site_id;
  ELSE
    DELETE FROM supply_centers WHERE id = p_site_id;
  END IF;

  UPDATE reports
  SET
    site_id = NULL,
    site_label = COALESCE(site_label, 'sitio eliminado')
  WHERE site_type = p_site_type AND site_id = p_site_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_site(TEXT, UUID) TO authenticated;

-- ============================================================
-- 6. Quitar solo el perfil de coordinador (conserva el sitio)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_remove_coordinator(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  DELETE FROM coordinator_profiles WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_remove_coordinator(UUID) TO authenticated;
