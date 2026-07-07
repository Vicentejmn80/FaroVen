-- FARO — High Severity Remediation A-12
-- Restore status = 'active' constraint on regional admin inserts.

DROP POLICY IF EXISTS regional_admin_insert_hospitals ON hospitals;
CREATE POLICY regional_admin_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');

DROP POLICY IF EXISTS regional_admin_insert_shelters ON shelters;
CREATE POLICY regional_admin_insert_shelters ON shelters
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');

DROP POLICY IF EXISTS regional_admin_insert_supply_centers ON supply_centers;
CREATE POLICY regional_admin_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin() AND status = 'active');
