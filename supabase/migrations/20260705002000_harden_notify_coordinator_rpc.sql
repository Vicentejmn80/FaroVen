-- FARO P0+ — Hardenización de notify_coordinator_request_user
-- Resultado de Security Validation Phase 2 — C-04 FAIL
--
-- Problema: notify_coordinator_request_user tenía protección exclusivamente via REVOKE externo
-- (migración 20260705001000). Sin guard interno, cualquier re-GRANT reabre el vector.
--
-- Solución: Agregar guard de autorización interno sin cambiar firma, comportamiento ni arquitectura.
-- Llamadas internas legítimas desde approve_coordinator_request y reject_coordinator_request
-- (ambas SECURITY DEFINER ejecutadas por elevated_admin) seguirán funcionando.

CREATE OR REPLACE FUNCTION notify_coordinator_request_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_payload JSONB,
  p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard de autorización:
  -- Bloquear llamadas directas de usuarios autenticados que no sean elevated_admin.
  -- Las llamadas desde funciones SECURITY DEFINER de admin llegan con auth.uid()
  -- del admin original, quien SÍ es elevated_admin → el check pasa.
  -- Un usuario normal que llame directamente tendrá is_elevated_admin() = false → RAISE.
  IF auth.uid() IS NOT NULL AND NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  PERFORM create_notification(
    p_user_id,
    p_title,
    p_body,
    p_type,
    CASE WHEN p_type = 'coordinator_request_rejected'
      THEN 'high'::notification_priority
      ELSE 'normal'::notification_priority
    END,
    NULL,
    CASE
      WHEN p_type = 'coordinator_request_approved'  THEN 'tab:ops'
      WHEN p_type = 'coordinator_info_request'      THEN 'tab:profile:coordinator-request'
      ELSE                                               'tab:profile:coordinator-request'
    END,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('request_id', p_request_id)
  );
END;
$$;

-- Idempotencia: revocar por si algún re-GRANT fue aplicado accidentalmente.
-- CREATE OR REPLACE preserva grants existentes en PostgreSQL; este REVOKE es la barrera final.
REVOKE EXECUTE ON FUNCTION notify_coordinator_request_user(UUID, TEXT, TEXT, TEXT, JSONB, UUID)
  FROM authenticated;
