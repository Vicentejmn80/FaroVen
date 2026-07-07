-- FARO — High Severity Remediation A-06
-- Harden rate limiting: avoid spoofable X-Forwarded-For headers.

-- ============================================================
-- A-06: Use server-derived IP (request.ip / inet_client_addr)
-- ============================================================
CREATE OR REPLACE FUNCTION security_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT;
BEGIN
  -- Prefer PostgREST-provided request.ip if available.
  v_ip := nullif(current_setting('request.ip', true), '');

  -- Fallback to the connection address (not client-supplied headers).
  IF v_ip IS NULL THEN
    v_ip := nullif(inet_client_addr()::text, '');
  END IF;

  IF v_ip IS NULL THEN
    v_ip := 'unknown';
  END IF;

  RETURN v_ip;
END;
$$;
