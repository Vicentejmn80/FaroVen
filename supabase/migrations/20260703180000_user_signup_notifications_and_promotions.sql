-- Notificación de registro de usuario + promoción directa a coordinador
-- Idempotente.

-- ============================================================
-- 1. Notificar solo a super_admin
-- ============================================================

CREATE OR REPLACE FUNCTION notify_super_admins(
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_related_request_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  FOR v_admin IN
    SELECT id FROM profiles
    WHERE role = 'super_admin'
      AND status = 'active'
  LOOP
    INSERT INTO admin_notifications (
      user_id,
      type,
      title,
      body,
      payload,
      related_request_id
    ) VALUES (
      v_admin.id,
      p_type,
      p_title,
      p_body,
      coalesce(p_payload, '{}'::jsonb),
      p_related_request_id
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2. Avisar cuando se crea un perfil (registro de usuario)
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
BEGIN
  v_full_name := coalesce(NEW.raw_user_meta_data ->> 'full_name', '');
  v_email := coalesce(NEW.email, '');

  INSERT INTO profiles (id, email, full_name, status)
  VALUES (NEW.id, v_email, v_full_name, 'active')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  PERFORM notify_super_admins(
    'user_signup',
    'Nuevo usuario registrado',
    coalesce(nullif(trim(v_full_name), ''), 'Usuario sin nombre')
      || ' (' || v_email || ') creó una cuenta en FARO.',
    jsonb_build_object(
      'user_id', NEW.id,
      'user_name', coalesce(nullif(trim(v_full_name), ''), 'Usuario sin nombre'),
      'user_email', v_email
    )
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Promover a coordinador con centro asignado (super_admin)
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

GRANT EXECUTE ON FUNCTION assign_coordinator_role(UUID, TEXT, UUID) TO authenticated;
