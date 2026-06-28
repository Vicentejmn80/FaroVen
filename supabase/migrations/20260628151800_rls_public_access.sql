-- Minimal RLS for public MVP: read core data, create citizen reports.
-- Idempotent: safe to re-run.

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_hospitals ON hospitals;
CREATE POLICY public_read_hospitals
  ON hospitals FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS public_read_shelters ON shelters;
CREATE POLICY public_read_shelters
  ON shelters FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS public_read_supply_centers ON supply_centers;
CREATE POLICY public_read_supply_centers
  ON supply_centers FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS public_read_needs ON needs;
CREATE POLICY public_read_needs
  ON needs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS public_read_persons ON persons;
CREATE POLICY public_read_persons
  ON persons FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS anon_insert_reports ON reports;
CREATE POLICY anon_insert_reports
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
