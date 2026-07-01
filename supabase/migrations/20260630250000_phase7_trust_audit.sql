-- FARO Fase 7 — Trust Layer: auditoría operativa (admin / depuración).
-- Idempotente.

CREATE TABLE IF NOT EXISTS operational_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_type TEXT CHECK (center_type IS NULL OR center_type IN ('hospital', 'shelter', 'supply_center')),
  center_id UUID,
  actor_label TEXT NOT NULL DEFAULT 'Sistema',
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_audit_center
  ON operational_audit_logs (center_type, center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_created
  ON operational_audit_logs (created_at DESC);

ALTER TABLE operational_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_read_operational_audit ON operational_audit_logs;
CREATE POLICY admin_read_operational_audit
  ON operational_audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- Inserciones solo vía triggers SECURITY DEFINER.
CREATE OR REPLACE FUNCTION log_operational_audit(
  p_center_type TEXT,
  p_center_id UUID,
  p_actor_label TEXT,
  p_action TEXT,
  p_old_value TEXT,
  p_new_value TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO operational_audit_logs (
    center_type, center_id, actor_label, action, old_value, new_value, metadata
  ) VALUES (
    p_center_type, p_center_id, p_actor_label, p_action, p_old_value, p_new_value, p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION audit_need_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_operational_audit(
    NEW.needable_type,
    NEW.needable_id,
    'Coordinador',
    CASE WHEN TG_OP = 'INSERT' THEN 'need_created' ELSE 'need_updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.item_name || ': ' || OLD.qty_received || '/' || OLD.qty_required ELSE NULL END,
    NEW.item_name || ': ' || NEW.qty_received || '/' || NEW.qty_required,
    jsonb_build_object('need_id', NEW.id, 'priority', NEW.priority)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_needs_audit ON needs;
CREATE TRIGGER trg_needs_audit
AFTER INSERT OR UPDATE ON needs
FOR EACH ROW
EXECUTE FUNCTION audit_need_change();

CREATE OR REPLACE FUNCTION audit_report_review()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_operational_audit(
      NEW.site_type,
      NEW.site_id,
      'Coordinador',
      'report_' || NEW.status,
      OLD.status::TEXT,
      NEW.status::TEXT,
      jsonb_build_object('report_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reports_audit ON reports;
CREATE TRIGGER trg_reports_audit
AFTER UPDATE OF status ON reports
FOR EACH ROW
EXECUTE FUNCTION audit_report_review();

CREATE OR REPLACE FUNCTION audit_center_saturation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.current_occ IS DISTINCT FROM NEW.current_occ
    OR OLD.capacity IS DISTINCT FROM NEW.capacity
    OR OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    PERFORM log_operational_audit(
      TG_ARGV[0],
      NEW.id,
      'Coordinador',
      'center_updated',
      coalesce(OLD.current_occ::TEXT, '') || '/' || coalesce(OLD.capacity::TEXT, ''),
      coalesce(NEW.current_occ::TEXT, '') || '/' || coalesce(NEW.capacity::TEXT, ''),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_hospitals_audit ON hospitals;
CREATE TRIGGER trg_hospitals_audit
AFTER UPDATE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION audit_center_saturation('hospital');

DROP TRIGGER IF EXISTS trg_shelters_audit ON shelters;
CREATE TRIGGER trg_shelters_audit
AFTER UPDATE ON shelters
FOR EACH ROW
EXECUTE FUNCTION audit_center_saturation('shelter');

CREATE OR REPLACE FUNCTION audit_center_status_only()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_operational_audit(
    TG_ARGV[0],
    NEW.id,
    'Coordinador',
    'center_status_updated',
    OLD.status,
    NEW.status,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_supply_centers_audit ON supply_centers;
CREATE TRIGGER trg_supply_centers_audit
AFTER UPDATE OF status ON supply_centers
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION audit_center_status_only('supply_center');

GRANT SELECT ON operational_audit_logs TO authenticated;
