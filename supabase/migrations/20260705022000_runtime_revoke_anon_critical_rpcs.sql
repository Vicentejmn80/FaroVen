-- FARO — Runtime Remediation T-014/T-015/T-045
-- Revoke direct PUBLIC/anon EXECUTE on critical RPCs.
-- authenticated retains EXECUTE; internal SECURITY DEFINER guards apply.

-- Revocar a PUBLIC (hereda anon)
REVOKE EXECUTE ON FUNCTION public.notify_coordinator_request_user(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text, uuid, jsonb) FROM PUBLIC;

-- Asegurar que authenticated SÍ tiene permiso
GRANT EXECUTE ON FUNCTION public.notify_coordinator_request_user(uuid, text, text, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, uuid, jsonb) TO authenticated;

-- Verificar que las funciones son SECURITY DEFINER
ALTER FUNCTION public.notify_coordinator_request_user(uuid, text, text, text, jsonb, uuid) SECURITY DEFINER;
ALTER FUNCTION public.log_auth_event(text, uuid, jsonb) SECURITY DEFINER;

-- Comentario explicativo
COMMENT ON FUNCTION public.notify_coordinator_request_user IS 'SECURITY DEFINER - Solo llamable por authenticated. Revocado de PUBLIC/anon en migración 20260705022000';
COMMENT ON FUNCTION public.log_auth_event IS 'SECURITY DEFINER - Solo llamable por authenticated. Revocado de PUBLIC/anon en migración 20260705022000';
