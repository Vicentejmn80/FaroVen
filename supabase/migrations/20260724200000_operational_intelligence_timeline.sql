-- ÉPICA 10 · OIE — tablas de timeline e snapshots de inteligencia operacional
-- Requeridas por operationalIntelligenceService.emitTimelineEvent / saveContextSnapshot

CREATE TABLE IF NOT EXISTS operational_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'warning', 'critical')),
  entity_id   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_timeline_timestamp
  ON operational_timeline (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_operational_timeline_type
  ON operational_timeline (type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_operational_timeline_entity
  ON operational_timeline (entity_id)
  WHERE entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context     JSONB NOT NULL,
  risk_score  NUMERIC,
  risk_level  TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_snapshots_timestamp
  ON intelligence_snapshots (timestamp DESC);

ALTER TABLE operational_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ot_select_ops ON operational_timeline;
CREATE POLICY ot_select_ops ON operational_timeline
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin', 'volunteer')
    )
  );

DROP POLICY IF EXISTS ot_insert_ops ON operational_timeline;
CREATE POLICY ot_insert_ops ON operational_timeline
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin', 'volunteer')
    )
  );

DROP POLICY IF EXISTS is_select_ops ON intelligence_snapshots;
CREATE POLICY is_select_ops ON intelligence_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS is_insert_ops ON intelligence_snapshots;
CREATE POLICY is_insert_ops ON intelligence_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'operational_timeline'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE operational_timeline;
  END IF;
END $$;
