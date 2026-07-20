-- FARO Red de Apoyo — Selección de rol post-registro
-- volunteer / case_manager + solicitud pending con acceso como voluntario.

-- ============================================================
-- 1. Extender enum faro_user_role
-- ============================================================
DO $$ BEGIN
  ALTER TYPE faro_user_role ADD VALUE IF NOT EXISTS 'volunteer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE faro_user_role ADD VALUE IF NOT EXISTS 'case_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE network_role_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Columnas en profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS network_role_selected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_role faro_user_role,
  ADD COLUMN IF NOT EXISTS role_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS role_request_status network_role_request_status,
  ADD COLUMN IF NOT EXISTS role_request_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role_request_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_request_status
  ON profiles(role_request_status)
  WHERE role_request_status = 'pending';

COMMENT ON COLUMN profiles.pending_role IS 'Rol solicitado (case_manager|coordinator) mientras role_request_status=pending. El rol efectivo sigue siendo volunteer.';
COMMENT ON COLUMN profiles.network_role_selected_at IS 'Marca que el usuario completó la selección de rol de Red de Apoyo.';

-- ============================================================
-- 3. Guard: permitir bootstrap null → volunteer (vía RPC / misma regla)
-- ============================================================
CREATE OR REPLACE FUNCTION guard_profile_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_super_admin() THEN
    -- Bootstrap post-registro: sin rol → volunteer (selección o solicitud pending)
    IF auth.uid() = NEW.id
       AND OLD.role IS NULL
       AND NEW.role = 'volunteer'
       AND NEW.status = 'active'
    THEN
      NULL; -- permitido
    ELSIF current_setting('faro.allow_role_bootstrap', true) = 'on' THEN
      NULL; -- permitido desde RPC SECURITY DEFINER
    ELSE
      RAISE EXCEPTION 'role_change_forbidden';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'status_change_forbidden';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. RPC: elegir Voluntario
-- ============================================================
CREATE OR REPLACE FUNCTION select_volunteer_role()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_row FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_row.status = 'suspended' THEN
    RAISE EXCEPTION 'account_suspended';
  END IF;

  -- Ya tiene rol operativo elevado: no tocar
  IF v_row.role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin') THEN
    RETURN v_row;
  END IF;

  -- Ya es voluntario: solo asegurar marca de selección
  IF v_row.role = 'volunteer' THEN
    UPDATE profiles
    SET
      network_role_selected_at = COALESCE(network_role_selected_at, now()),
      updated_at = now()
    WHERE id = auth.uid()
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF v_row.role IS NOT NULL THEN
    RAISE EXCEPTION 'role_already_assigned';
  END IF;

  PERFORM set_config('faro.allow_role_bootstrap', 'on', true);

  UPDATE profiles
  SET
    role = 'volunteer',
    status = 'active',
    network_role_selected_at = now(),
    pending_role = NULL,
    role_request_reason = NULL,
    role_request_status = NULL,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  PERFORM log_auth_event(
    'network_role_selected',
    auth.uid(),
    jsonb_build_object('role', 'volunteer')
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION select_volunteer_role() TO authenticated;

-- ============================================================
-- 5. RPC: solicitar Gestor / Coordinador (queda como volunteer + pending)
-- ============================================================
CREATE OR REPLACE FUNCTION request_network_role(
  p_role TEXT,
  p_reason TEXT
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row profiles%ROWTYPE;
  v_reason TEXT;
  v_pending faro_user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_role NOT IN ('case_manager', 'coordinator') THEN
    RAISE EXCEPTION 'invalid_requested_role';
  END IF;

  v_reason := trim(coalesce(p_reason, ''));
  IF char_length(v_reason) < 12 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;
  IF char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'reason_too_long';
  END IF;

  v_pending := p_role::faro_user_role;

  SELECT * INTO v_row FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_row.status = 'suspended' THEN
    RAISE EXCEPTION 'account_suspended';
  END IF;

  IF v_row.role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin') THEN
    RAISE EXCEPTION 'role_already_assigned';
  END IF;

  IF v_row.role_request_status = 'pending' THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  PERFORM set_config('faro.allow_role_bootstrap', 'on', true);

  UPDATE profiles
  SET
    role = 'volunteer',
    status = 'active',
    network_role_selected_at = COALESCE(network_role_selected_at, now()),
    pending_role = v_pending,
    role_request_reason = v_reason,
    role_request_status = 'pending',
    role_request_reviewed_at = NULL,
    role_request_reviewed_by = NULL,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_row;

  PERFORM log_auth_event(
    'network_role_requested',
    auth.uid(),
    jsonb_build_object('pending_role', p_role, 'reason', left(v_reason, 200))
  );

  PERFORM notify_elevated_admins(
    'network_role_request',
    'Nueva solicitud de rol',
    coalesce(v_row.full_name, v_row.email) || ' solicita: ' || p_role,
    'high',
    'user-plus',
    'tab:admin',
    jsonb_build_object(
      'user_id', v_row.id,
      'pending_role', p_role
    ),
    false
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION request_network_role(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. RPC admin: aprobar / rechazar solicitud de red
-- ============================================================
CREATE OR REPLACE FUNCTION review_network_role_request(
  p_user_id UUID,
  p_approve BOOLEAN,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row profiles%ROWTYPE;
  v_target faro_user_role;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_row FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_row.role_request_status IS DISTINCT FROM 'pending' OR v_row.pending_role IS NULL THEN
    RAISE EXCEPTION 'no_pending_request';
  END IF;

  v_target := v_row.pending_role;

  IF p_approve THEN
    IF v_target NOT IN ('case_manager', 'coordinator') THEN
      RAISE EXCEPTION 'invalid_pending_role';
    END IF;

    -- Solo super_admin puede aprobar coordinador (asignación de centro aparte)
    IF v_target = 'coordinator' AND NOT is_super_admin() THEN
      RAISE EXCEPTION 'super_admin_required_for_coordinator';
    END IF;

    PERFORM set_config('faro.allow_role_bootstrap', 'on', true);

    UPDATE profiles
    SET
      role = v_target,
      pending_role = NULL,
      role_request_status = 'approved',
      role_request_reviewed_at = now(),
      role_request_reviewed_by = auth.uid(),
      updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO v_row;

    PERFORM create_notification(
      p_user_id,
      'Solicitud aprobada',
      'Tu solicitud de rol fue aprobada. Ya puedes usar tus nuevos permisos.',
      'network_role_approved',
      'high',
      NULL,
      'tab:profile',
      jsonb_build_object('role', v_target::text),
      NULL
    );
  ELSE
    UPDATE profiles
    SET
      pending_role = NULL,
      role_request_status = 'rejected',
      role_request_reason = CASE
        WHEN nullif(trim(p_review_notes), '') IS NULL THEN role_request_reason
        ELSE left(trim(p_review_notes), 1000)
      END,
      role_request_reviewed_at = now(),
      role_request_reviewed_by = auth.uid(),
      updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO v_row;

    PERFORM create_notification(
      p_user_id,
      'Solicitud no aprobada',
      coalesce(nullif(trim(p_review_notes), ''), 'Tu solicitud de rol no fue aprobada en este momento.'),
      'network_role_rejected',
      'normal',
      NULL,
      'tab:profile',
      jsonb_build_object('role', v_target::text),
      NULL
    );
  END IF;

  PERFORM log_auth_event(
    CASE WHEN p_approve THEN 'network_role_approved' ELSE 'network_role_rejected' END,
    p_user_id,
    jsonb_build_object('role', v_target::text)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION review_network_role_request(UUID, BOOLEAN, TEXT) TO authenticated;
