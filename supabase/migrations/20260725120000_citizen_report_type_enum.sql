-- Citizen portal report categories + indexes for high-volume inbox queries

ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'need';
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'damage';
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'center';
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'person';
ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'infra';

-- Case manager / coordinator filters: status + category + recency
CREATE INDEX IF NOT EXISTS idx_reports_status_type_created
  ON reports (status, type, created_at DESC);

-- Hot path: pending citizen reports queue
CREATE INDEX IF NOT EXISTS idx_reports_pending_created
  ON reports (created_at DESC)
  WHERE status = 'pending';
