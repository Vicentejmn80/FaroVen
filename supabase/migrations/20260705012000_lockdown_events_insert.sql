-- FARO — High Severity Remediation A-04
-- Lock down open INSERT on events to prevent fake timeline entries.

-- ============================================================
-- A-04: Remove open insert policy and grants for events
-- ============================================================
DROP POLICY IF EXISTS system_insert_events ON events;

REVOKE INSERT ON events FROM authenticated;
REVOKE INSERT ON events FROM anon;
