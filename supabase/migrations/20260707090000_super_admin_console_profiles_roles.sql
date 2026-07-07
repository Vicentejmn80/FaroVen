-- Super Admin console: perfiles extendidos, gestión de roles y políticas admin
-- Idempotente.

-- ============================================================
-- 1. Campos de perfil (teléfono + extensión futura)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT;

COMMENT ON COLUMN profiles.phone IS 'Teléfono de contacto (obligatorio en nuevos registros vía app)';
COMMENT ON COLUMN profiles.organization_name IS 'Organización declarada (futuro)';
COMMENT ON COLUMN profiles.profession IS 'Profesión (futuro)';
COMMENT ON COLUMN profiles.specialty IS 'Especialidad (futuro)';
COMMENT ON COLUMN profiles.municipality IS 'Municipio (futuro)';

-- ============================================================
-- 2. Bootstrap super_admin principal
-- ============================================================
UPDATE profiles
SET role = 'super_admin',
    status = 'active',
    full_name = COALESCE(NULLIF(trim(full_name), ''), 'Vicente José'),
    updated_at = now()
WHERE lower(email) = 'vicentejmn80@gmail.com';

INSERT INTO profiles (id, email, full_name, role, status)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', 'Vicente José'), 'super_admin', 'active'
FROM auth.users u
WHERE lower(u.email) = 'vicentejmn80@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin',
      status = 'active',
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = now();

-- ============================================================
-- 3. handle_new_user — teléfono desde metadata
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
  v_phone TEXT;
BEGIN
  v_full_name := coalesce(NEW.raw_user_meta_data ->> 'full_name', '');
  v_email := coalesce(NEW.email, '');
  v_phone := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'phone', '')), '');

  INSERT INTO profiles (id, email, full_name, phone, status)
  VALUES (NEW.id, v_email, v_full_name, v_phone, 'active')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE
          WHEN coalesce(trim(profiles.full_name), '') = '' THEN EXCLUDED.full_name
          ELSE profiles.full_name
        END,
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        updated_at = now();

  PERFORM notify_super_admins(
    'user_signup',
    'Nuevo usuario registrado',
    coalesce(nullif(trim(v_full_name), ''), 'Usuario sin nombre')
      || ' (' || v_email || ') creó una cuenta en FARO.',
    jsonb_build_object(
      'user_id', NEW.id,
      'user_name', coalesce(nullif(trim(v_full_name), ''), 'Usuario sin nombre'),
      'user_email', v_email,
      'phone', v_phone
    )
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. promote_user_role — no permitir coordinador sin sitio
-- ============================================================
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

  IF p_role = 'coordinator' THEN
    RAISE EXCEPTION 'coordinator_requires_site';
  END IF;

  SELECT role::text INTO v_old_role FROM profiles WHERE id = p_user_id;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.role = 'super_admin' AND p_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  UPDATE profiles
  SET role = p_role,
      status = 'active',
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  PERFORM log_auth_event(
    'role_changed',
    p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role::text)
  );

  RETURN v_profile;
END;
$$;

-- ============================================================
-- 5. revoke_coordinator_role — quitar rol + perfil coordinador
-- ============================================================
CREATE OR REPLACE FUNCTION revoke_coordinator_role(p_user_id UUID)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  DELETE FROM coordinator_profiles WHERE auth_user_id = p_user_id;

  UPDATE profiles
  SET role = NULL,
      updated_at = now()
  WHERE id = p_user_id
    AND role = 'coordinator'
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  END IF;

  PERFORM log_auth_event(
    'coordinator_revoked',
    p_user_id,
    '{}'::jsonb
  );

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_coordinator_role(UUID) TO authenticated;

-- ============================================================
-- 6. admin_update_user_status — suspender / reactivar
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_user_status(
  p_user_id UUID,
  p_status TEXT
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'pending') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  UPDATE profiles
  SET status = p_status,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  PERFORM log_auth_event(
    'status_changed',
    p_user_id,
    jsonb_build_object('status', p_status)
  );

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_user_status(UUID, TEXT) TO authenticated;

-- ============================================================
-- 7. admin_update_profile — edición super admin
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_organization_name TEXT DEFAULT NULL,
  p_profession TEXT DEFAULT NULL,
  p_specialty TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE profiles
  SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    phone = CASE WHEN p_phone IS NOT NULL THEN NULLIF(trim(p_phone), '') ELSE phone END,
    organization_name = CASE WHEN p_organization_name IS NOT NULL THEN NULLIF(trim(p_organization_name), '') ELSE organization_name END,
    profession = CASE WHEN p_profession IS NOT NULL THEN NULLIF(trim(p_profession), '') ELSE profession END,
    specialty = CASE WHEN p_specialty IS NOT NULL THEN NULLIF(trim(p_specialty), '') ELSE specialty END,
    municipality = CASE WHEN p_municipality IS NOT NULL THEN NULLIF(trim(p_municipality), '') ELSE municipality END,
    region = CASE WHEN p_region IS NOT NULL THEN NULLIF(trim(p_region), '') ELSE region END,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  PERFORM log_auth_event('profile_updated', p_user_id, '{}'::jsonb);

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. admin_remove_coordinator — también limpia rol si aplica
-- ============================================================
CREATE OR REPLACE FUNCTION admin_remove_coordinator(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT auth_user_id INTO v_auth_user_id
  FROM coordinator_profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  DELETE FROM coordinator_profiles WHERE id = p_profile_id;

  UPDATE profiles
  SET role = NULL, updated_at = now()
  WHERE id = v_auth_user_id AND role = 'coordinator';

  IF is_super_admin() AND v_auth_user_id IS NOT NULL THEN
    PERFORM log_auth_event('coordinator_removed', v_auth_user_id, jsonb_build_object('profile_id', p_profile_id));
  END IF;
END;
$$;

-- ============================================================
-- 9. assign_coordinator_role — validar sitio único activo
-- ============================================================
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

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'site_already_has_coordinator';
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
      'center_name', v_center_name
    )
  );

  RETURN v_profile;
END;
$$;

-- ============================================================
-- 10. Políticas super_admin para notifications y needs
-- ============================================================
DROP POLICY IF EXISTS notifications_super_admin_read ON notifications;
CREATE POLICY notifications_super_admin_read ON notifications
  FOR SELECT TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS notifications_super_admin_delete ON notifications;
CREATE POLICY notifications_super_admin_delete ON notifications
  FOR DELETE TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS needs_super_admin_update ON needs;
CREATE POLICY needs_super_admin_update ON needs
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS needs_super_admin_select ON needs;
-- Lectura pública de needs ya cubierta por políticas existentes

-- reports: is_admin() ya cubre super_admin vía admin_read/update_reports

-- ============================================================
-- 11. Listado admin de coordinadores
-- ============================================================
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
    cp.full_name,
    p.email,
    COALESCE(cp.phone, p.phone),
    cp.site_type,
    cp.site_id,
    CASE cp.site_type
      WHEN 'hospital' THEN (SELECT h.name FROM hospitals h WHERE h.id = cp.site_id)
      WHEN 'shelter' THEN (SELECT s.name FROM shelters s WHERE s.id = cp.site_id)
      ELSE (SELECT sc.name FROM supply_centers sc WHERE sc.id = cp.site_id)
    END,
    p.status::text,
    p.role::text,
    cp.updated_at
  FROM coordinator_profiles cp
  JOIN profiles p ON p.id = cp.auth_user_id
  ORDER BY cp.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_coordinators() TO authenticated;

-- ============================================================
-- 12. Listado admin de notificaciones recientes
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_notifications(p_limit INT DEFAULT 100)
RETURNS SETOF notifications
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
  SELECT *
  FROM notifications
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_notifications(INT) TO authenticated;
