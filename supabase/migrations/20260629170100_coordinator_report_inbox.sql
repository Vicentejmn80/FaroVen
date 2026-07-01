-- Coordinator report inbox: RLS so site coordinators can review their pending reports.
-- Site columns live in 20260629170000_reports_site_linking.sql.
-- Idempotente: seguro de re-ejecutar.

DROP POLICY IF EXISTS coordinator_read_own_site_reports ON reports;
CREATE POLICY coordinator_read_own_site_reports
  ON reports FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND site_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = reports.site_type
        AND cp.site_id = reports.site_id
    )
  );

DROP POLICY IF EXISTS coordinator_update_own_site_reports ON reports;
CREATE POLICY coordinator_update_own_site_reports
  ON reports FOR UPDATE
  TO authenticated
  USING (
    site_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = reports.site_type
        AND cp.site_id = reports.site_id
    )
  )
  WITH CHECK (
    site_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.onboarding_complete = true
        AND cp.site_type = reports.site_type
        AND cp.site_id = reports.site_id
    )
  );

GRANT SELECT, UPDATE ON reports TO authenticated;
