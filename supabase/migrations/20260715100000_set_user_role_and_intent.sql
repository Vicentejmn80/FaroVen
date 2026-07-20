-- FARO — Laboratorio: RPC unificado para cambio de roles + columna participation_intent
-- TEMPORAL: este RPC será reutilizado por el flujo oficial de aprobación de roles.
-- No reemplaza promote_user_role (que tiene restricciones específicas de coordinator).
-- Proporciona un mecanismo completo de cambio de rol para todos los roles del sistema.

-- ============================================================
-- 1. Columna participation_intent en profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS participation_intent TEXT
  CHECK (participation_intent IN ('need_help', 'want_to_help', 'represent_org'))
  DEFAULT NULL;

COMMENT ON COLUMN profiles.participation_intent IS 'Intención de participación del usuario. Valores: need_help, want_to_help, represent_org. Campo de dominio para métricas y analítica.';

-- ============================================================
-- 2. RPC set_user_role — cambio unificado de roles
-- ============================================================
CREATE OR REPLACE FUNCTION set_user_role(
  p_user_id UUID,
  p_new_role faro_user_role,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_profile RECORD;
  v_old_role faro_user_role;
  v_result JSONB;
BEGIN
  -- Guard: solo super admin puede usar este RPC
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Guard: no permitir que el super admin se reduzca a sí mismo
  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'cannot_modify_own_role';
  END IF;

  -- Obtener perfil actual del target
  SELECT id, role, status, full_name, email
  INTO v_target_profile
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_old_role := v_target_profile.role;

  -- Guard: no permitir modificar un super admin existente
  IF v_old_role = 'super_admin' AND p_new_role != 'super_admin' THEN
    RAISE EXCEPTION 'cannot_modify_super_admin';
  END IF;

  -- Actualizar rol
  UPDATE profiles
  SET role = p_new_role,
      status = 'active',
      updated_at = now()
  WHERE id = p_user_id;

  -- Log del cambio
  INSERT INTO auth_audit_logs (action, actor_id, target_user_id, metadata)
  VALUES (
    'dev_role_change',
    v_caller_id,
    p_user_id,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_new_role,
      'reason', p_reason,
      'target_name', v_target_profile.full_name,
      'target_email', v_target_profile.email
    )
  );

  -- Retornar perfil actualizado
  SELECT to_jsonb(p.*) INTO v_result
  FROM profiles p
  WHERE id = p_user_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION set_user_role(UUID, faro_user_role, TEXT) IS 'LABORATORIO FARO — RPC unificado para cambio de roles. Temporal hasta que el flujo oficial de aprobación esté completo. Requiere super_admin.';

-- ============================================================
-- 3. RPC set_participation_intent — cambio de intención de participación
-- ============================================================
CREATE OR REPLACE FUNCTION set_participation_intent(
  p_user_id UUID,
  p_intent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_profile RECORD;
  v_result JSONB;
BEGIN
  -- Guard: solo super admin puede usar este RPC
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Validar valor del intent
  IF p_intent IS NOT NULL AND p_intent NOT IN ('need_help', 'want_to_help', 'represent_org') THEN
    RAISE EXCEPTION 'invalid_participation_intent';
  END IF;

  -- Obtener perfil del target
  SELECT id, full_name, email
  INTO v_target_profile
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Actualizar participation_intent
  UPDATE profiles
  SET participation_intent = p_intent,
      updated_at = now()
  WHERE id = p_user_id;

  -- Log del cambio
  INSERT INTO auth_audit_logs (action, actor_id, target_user_id, metadata)
  VALUES (
    'participation_intent_changed',
    v_caller_id,
    p_user_id,
    jsonb_build_object(
      'new_intent', p_intent,
      'target_name', v_target_profile.full_name,
      'target_email', v_target_profile.email
    )
  );

  -- Retornar perfil actualizado
  SELECT to_jsonb(p.*) INTO v_result
  FROM profiles p
  WHERE id = p_user_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION set_participation_intent(UUID, TEXT) IS 'LABORATORIO FARO — Cambio de intención de participación. Requiere super_admin.';

-- ============================================================
-- 4. RPC list_all_profiles — listado completo para el Laboratorio
-- ============================================================
CREATE OR REPLACE FUNCTION list_all_profiles(
  p_search TEXT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(p.*) || jsonb_build_object(
    'coordinator_site_name', cs.site_name,
    'coordinator_site_type', cp.site_type
  )
  FROM profiles p
  LEFT JOIN coordinator_profiles cp ON cp.auth_user_id = p.id
  LEFT JOIN (
    SELECT id, name AS site_name FROM hospitals
    UNION ALL
    SELECT id, name AS site_name FROM shelters
    UNION ALL
    SELECT id, name AS site_name FROM supply_centers
  ) cs ON cs.id = cp.site_id
  WHERE p_search IS NULL
     OR p.full_name ILIKE '%' || p_search || '%'
     OR p.email ILIKE '%' || p_search || '%'
     OR p.id::text ILIKE '%' || p_search || '%'
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION list_all_profiles(TEXT) IS 'LABORATORIO FARO — Listado de perfiles con info de coordinator para el Laboratorio. Requiere super_admin.';
