-- Link citizen reports to registered sites (or capture orphan place metadata).

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS site_type TEXT
    CHECK (site_type IS NULL OR site_type IN ('hospital', 'shelter', 'supply_center')),
  ADD COLUMN IF NOT EXISTS site_id UUID,
  ADD COLUMN IF NOT EXISTS site_label TEXT,
  ADD COLUMN IF NOT EXISTS other_place_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_reports_site_status
  ON reports (site_type, site_id, status);
