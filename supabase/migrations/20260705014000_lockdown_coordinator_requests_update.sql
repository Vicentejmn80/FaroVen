-- FARO — High Severity Remediation A-09
-- Prevent direct UPDATE on coordinator_requests.status (bypass of approval workflow).

-- ============================================================
-- A-09: Remove open UPDATE for elevated admins on coordinator_requests
-- ============================================================
DROP POLICY IF EXISTS coordinator_requests_admin_update ON coordinator_requests;

REVOKE UPDATE ON coordinator_requests FROM authenticated;
