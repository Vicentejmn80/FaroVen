-- FARO Fase 9 — Autenticación, roles y control de acceso
-- Idempotente.

-- ============================================================
-- 1. Tipos y tablas base
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'faro_user_role') THEN
    CREATE TYPE faro_user_role AS ENUM ('coordinator', 'regional_admin', 'super_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coordinator_request_status') THEN
    CREATE TYPE coordinator_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  role faro_user_role,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id);

CREATE TABLE IF NOT EXISTS coordinator_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  requested_site_type TEXT CHECK (requested_site_type IN ('hospital', 'supply_center', 'shelter')),
  requested_site_id UUID,
  role_title TEXT,
  reason TEXT,
  status coordinator_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  assigned_site_type TEXT CHECK (assigned_site_type IN ('hospital', 'supply_center', 'shelter')),
  assigned_site_id UUID,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coordinator_requests_status ON coordinator_requests(status);
CREATE INDEX IF NOT EXISTS idx_coordinator_requests_email ON coordinator_requests(lower(email));

CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_logs(created_at DESC);

-- ============================================================
-- 2. Funciones de rol
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM profiles
  WHERE id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_regional_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = 'regional_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_coordinator_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = 'coordinator'
  );
$$;

CREATE OR REPLACE FUNCTION is_elevated_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin() OR is_regional_admin();
$$;

-- Compatibilidad con fases anteriores + roles nuevos
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  OR is_elevated_admin()
  OR is_super_admin();
$$;

GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_regional_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_coordinator_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_elevated_admin() TO authenticated;

-- ============================================================
-- 3. Perfil automático al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    coalesce(NEW.raw_user_meta_data ->> 'full_name', ''),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 4. Auditoría de auth
-- ============================================================

CREATE OR REPLACE FUNCTION log_auth_event(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO auth_audit_logs (actor_user_id, action, target_user_id, metadata)
  VALUES (auth.uid(), p_action, p_target_user_id, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_auth_event(TEXT, UUID, JSONB) TO authenticated;

-- ============================================================
-- 5. Aprobar / rechazar solicitudes de coordinador
-- ============================================================

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

  v_user_id := v_request.auth_user_id;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_request.email) LIMIT 1;
  END IF;

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
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE coordinator_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = p_review_notes,
      updated_at = now()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found_or_not_pending';
  END IF;

  PERFORM log_auth_event(
    'coordinator_request_rejected',
    v_request.auth_user_id,
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_coordinator_request(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_coordinator_request(UUID, TEXT) TO authenticated;

-- Bootstrap: correos admin existentes → super_admin
INSERT INTO profiles (id, email, full_name, role, status)
SELECT u.id, ae.email, coalesce(u.raw_user_meta_data ->> 'full_name', ''), 'super_admin', 'active'
FROM admin_emails ae
JOIN auth.users u ON lower(u.email) = lower(ae.email)
ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin',
      status = 'active',
      updated_at = now();

-- ============================================================
-- 6. RLS — profiles
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_elevated_admin() OR is_super_admin());

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- ============================================================
-- 7. RLS — coordinator_requests
-- ============================================================

ALTER TABLE coordinator_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coordinator_requests_insert ON coordinator_requests;
CREATE POLICY coordinator_requests_insert ON coordinator_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    OR auth_user_id IS NULL
  );

DROP POLICY IF EXISTS coordinator_requests_select_own ON coordinator_requests;
CREATE POLICY coordinator_requests_select_own ON coordinator_requests
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR is_elevated_admin()
  );

DROP POLICY IF EXISTS coordinator_requests_admin_update ON coordinator_requests;
CREATE POLICY coordinator_requests_admin_update ON coordinator_requests
  FOR UPDATE TO authenticated
  USING (is_elevated_admin())
  WITH CHECK (is_elevated_admin());

GRANT SELECT, INSERT, UPDATE ON coordinator_requests TO authenticated;

-- ============================================================
-- 8. RLS — auth_audit_logs
-- ============================================================

ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_audit_admin_read ON auth_audit_logs;
CREATE POLICY auth_audit_admin_read ON auth_audit_logs
  FOR SELECT TO authenticated
  USING (is_super_admin() OR is_regional_admin());

GRANT SELECT ON auth_audit_logs TO authenticated;

-- ============================================================
-- 9. Endurecer seguridad operativa (coordinador autenticado)
-- ============================================================

DROP POLICY IF EXISTS public_review_pending_reports ON reports;
CREATE POLICY coordinator_review_own_site_reports ON reports
  FOR UPDATE TO authenticated
  USING (
    status IN ('pending', 'under_review')
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_id = reports.site_id
        AND cp.site_type = reports.site_type
        AND cp.onboarding_complete IS NOT FALSE
    )
  )
  WITH CHECK (
    status IN ('verified', 'dismissed', 'under_review', 'pending')
  );

REVOKE UPDATE ON reports FROM anon;

-- Coordinadores no crean centros (solo admins regionales)
DROP POLICY IF EXISTS coordinator_insert_hospitals ON hospitals;
DROP POLICY IF EXISTS coordinator_insert_supply_centers ON supply_centers;
DROP POLICY IF EXISTS coordinator_insert_shelters ON shelters;

DROP POLICY IF EXISTS regional_admin_insert_hospitals ON hospitals;
CREATE POLICY regional_admin_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');

DROP POLICY IF EXISTS regional_admin_insert_supply_centers ON supply_centers;
CREATE POLICY regional_admin_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');

DROP POLICY IF EXISTS regional_admin_insert_shelters ON shelters;
CREATE POLICY regional_admin_insert_shelters ON shelters
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');

DROP POLICY IF EXISTS regional_admin_update_hospitals ON hospitals;
CREATE POLICY regional_admin_update_hospitals ON hospitals
  FOR UPDATE TO authenticated
  USING (is_elevated_admin() OR EXISTS (
    SELECT 1 FROM coordinator_profiles cp
    WHERE cp.auth_user_id = auth.uid() AND cp.site_type = 'hospital' AND cp.site_id = hospitals.id
  ))
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS regional_admin_update_supply_centers ON supply_centers;
CREATE POLICY regional_admin_update_supply_centers ON supply_centers
  FOR UPDATE TO authenticated
  USING (is_elevated_admin() OR EXISTS (
    SELECT 1 FROM coordinator_profiles cp
    WHERE cp.auth_user_id = auth.uid() AND cp.site_type = 'supply_center' AND cp.site_id = supply_centers.id
  ))
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS regional_admin_update_shelters ON shelters;
CREATE POLICY regional_admin_update_shelters ON shelters
  FOR UPDATE TO authenticated
  USING (is_elevated_admin() OR EXISTS (
    SELECT 1 FROM coordinator_profiles cp
    WHERE cp.auth_user_id = auth.uid() AND cp.site_type = 'shelter' AND cp.site_id = shelters.id
  ))
  WITH CHECK (status = 'active');
