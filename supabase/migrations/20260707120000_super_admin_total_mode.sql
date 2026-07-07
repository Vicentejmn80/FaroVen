-- Modo Administración Total — permisos exclusivos super_admin
-- Idempotente. NO desactiva RLS; añade policies/RPCs solo para is_super_admin().

-- ============================================================
-- 1. Integridad FK coordinator_profiles → auth.users
-- ============================================================
DELETE FROM coordinator_profiles cp
WHERE cp.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.auth_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coordinator_profiles_auth_user_id_fkey'
  ) THEN
    ALTER TABLE coordinator_profiles
      ADD CONSTRAINT coordinator_profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. RLS super_admin — operaciones bloqueadas para otros
-- ============================================================

DROP POLICY IF EXISTS needs_super_admin_insert ON needs;
CREATE POLICY needs_super_admin_insert ON needs
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS reports_super_admin_delete ON reports;
CREATE POLICY reports_super_admin_delete ON reports
  FOR DELETE TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS events_super_admin_delete ON events;
CREATE POLICY events_super_admin_delete ON events
  FOR DELETE TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS notifications_super_admin_update ON notifications;
CREATE POLICY notifications_super_admin_update ON notifications
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS profiles_super_admin_delete ON profiles;
CREATE POLICY profiles_super_admin_delete ON profiles
  FOR DELETE TO authenticated
  USING (is_super_admin() AND id <> auth.uid());

-- ============================================================
-- 3. admin_demote_user — quitar rol (excepto super_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_demote_user(p_user_id UUID)
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

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_demote_self';
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
  RETURNING * INTO v_profile;

  PERFORM log_auth_event('user_demoted', p_user_id, '{}'::jsonb);

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_demote_user(UUID) TO authenticated;

-- ============================================================
-- 4. admin_delete_user — eliminación permanente (Auth + datos)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_user_id UUID,
  p_confirm_super_admin BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_email TEXT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_delete_self';
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_profile.role = 'super_admin' AND NOT COALESCE(p_confirm_super_admin, false) THEN
    RAISE EXCEPTION 'confirm_super_admin_required';
  END IF;

  v_email := v_profile.email;

  DELETE FROM coordinator_profiles WHERE auth_user_id = p_user_id;
  DELETE FROM coordinator_requests WHERE auth_user_id = p_user_id;
  DELETE FROM admin_notifications WHERE user_id = p_user_id;
  DELETE FROM user_notifications WHERE user_id = p_user_id;

  PERFORM log_auth_event(
    'user_deleted',
    p_user_id,
    jsonb_build_object('email', v_email, 'deleted_by', auth.uid())
  );

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_user(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 5. admin_delete_report — eliminación definitiva
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_report(p_report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM reports WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_not_found';
  END IF;

  PERFORM log_auth_event('report_deleted', NULL, jsonb_build_object('report_id', p_report_id));
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_report(UUID) TO authenticated;

-- ============================================================
-- 6. admin_delete_event
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_event(UUID) TO authenticated;

-- ============================================================
-- 7. admin_create_need — crear necesidad sin ser coordinador
-- ============================================================
CREATE OR REPLACE FUNCTION admin_create_need(
  p_needable_type TEXT,
  p_needable_id UUID,
  p_item_name TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_qty_required INT DEFAULT 1,
  p_qty_received INT DEFAULT 0
)
RETURNS needs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_need needs%ROWTYPE;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_needable_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_site_type';
  END IF;

  IF p_priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'invalid_priority';
  END IF;

  INSERT INTO needs (
    needable_type,
    needable_id,
    item_name,
    priority,
    qty_required,
    qty_received,
    unit
  )
  VALUES (
    p_needable_type,
    p_needable_id,
    trim(p_item_name),
    p_priority,
    GREATEST(p_qty_required, 0),
    GREATEST(p_qty_received, 0),
    'unidades'
  )
  RETURNING * INTO v_need;

  RETURN v_need;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_need(TEXT, UUID, TEXT, TEXT, INT, INT) TO authenticated;

-- ============================================================
-- 8. admin_mark_need_covered
-- ============================================================
CREATE OR REPLACE FUNCTION admin_mark_need_covered(p_need_id UUID)
RETURNS needs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_need needs%ROWTYPE;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE needs
  SET qty_received = qty_required,
      updated_at = now()
  WHERE id = p_need_id
  RETURNING * INTO v_need;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'need_not_found';
  END IF;

  RETURN v_need;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_mark_need_covered(UUID) TO authenticated;

-- ============================================================
-- 9. admin_reset_operational_data — limpieza dev (conserva super_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_reset_operational_data(
  p_preserve_email TEXT DEFAULT 'vicentejmn80@gmail.com'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_preserve_id UUID;
  v_counts JSONB := '{}'::jsonb;
  v_n INT;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_preserve_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_preserve_email))
  LIMIT 1;

  IF v_preserve_id IS NULL THEN
    RAISE EXCEPTION 'preserve_user_not_found';
  END IF;

  DELETE FROM needs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('needs', v_n);

  DELETE FROM site_saturation;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('site_saturation', v_n);

  DELETE FROM reports;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('reports', v_n);

  DELETE FROM persons;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('persons', v_n);

  DELETE FROM events;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('events', v_n);

  DELETE FROM notifications WHERE user_id <> v_preserve_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('notifications', v_n);

  DELETE FROM admin_notifications WHERE user_id <> v_preserve_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('admin_notifications', v_n);

  DELETE FROM coordinator_requests;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('coordinator_requests', v_n);

  DELETE FROM coordinator_profiles WHERE auth_user_id <> v_preserve_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('coordinator_profiles', v_n);

  DELETE FROM hospitals;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('hospitals', v_n);

  DELETE FROM shelters;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('shelters', v_n);

  DELETE FROM supply_centers;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('supply_centers', v_n);

  DELETE FROM guide_feedback;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('guide_feedback', v_n);

  DELETE FROM operational_audit_logs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('operational_audit_logs', v_n);

  DELETE FROM auth_audit_logs;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('auth_audit_logs', v_n);

  DELETE FROM bulletins WHERE true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('bulletins', v_n);

  DELETE FROM updates WHERE true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('updates', v_n);

  DELETE FROM auth.users WHERE id <> v_preserve_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('auth_users_deleted', v_n);

  PERFORM log_auth_event(
    'operational_data_reset',
    v_preserve_id,
    jsonb_build_object('preserve_email', p_preserve_email, 'counts', v_counts)
  );

  RETURN v_counts || jsonb_build_object('preserved_user_id', v_preserve_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_operational_data(TEXT) TO authenticated;

-- ============================================================
-- 10. Restringir RPCs sensibles de sitio solo a super_admin
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_site(p_site_type TEXT, p_site_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_site_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'site_type inválido: %', p_site_type;
  END IF;

  DELETE FROM needs
  WHERE needable_type = p_site_type AND needable_id = p_site_id;

  DELETE FROM site_saturation
  WHERE site_type = p_site_type AND site_id = p_site_id;

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
  SET site_id = NULL,
      site_label = COALESCE(site_label, 'sitio eliminado')
  WHERE site_type = p_site_type AND site_id = p_site_id;

  PERFORM log_auth_event('site_deleted', NULL, jsonb_build_object('site_type', p_site_type, 'site_id', p_site_id));
END;
$$;

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

CREATE OR REPLACE FUNCTION admin_remove_coordinator(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
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

  PERFORM log_auth_event('coordinator_removed', v_auth_user_id, jsonb_build_object('profile_id', p_profile_id));
END;
$$;
