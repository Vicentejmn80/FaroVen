-- FARO — Coordinator Operations Center V1
-- Agrega capacidades operativas a los centros: modo operativo,
-- desglose de ocupación, recursos en tiempo real, solicitudes de apoyo,
-- y eventos operativos del centro.
-- ============================================================

-- ============================================================
-- 1. Columnas operativas en las 3 tablas de centros
-- ============================================================
DO $$ BEGIN
  ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active'
    CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS occupancy_adults INT NOT NULL DEFAULT 0;
  ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS occupancy_children INT NOT NULL DEFAULT 0;
  ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS occupancy_elderly INT NOT NULL DEFAULT 0;
  ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS occupancy_disabled_mobility INT NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE shelters ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active'
    CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  ALTER TABLE shelters ADD COLUMN IF NOT EXISTS occupancy_adults INT NOT NULL DEFAULT 0;
  ALTER TABLE shelters ADD COLUMN IF NOT EXISTS occupancy_children INT NOT NULL DEFAULT 0;
  ALTER TABLE shelters ADD COLUMN IF NOT EXISTS occupancy_elderly INT NOT NULL DEFAULT 0;
  ALTER TABLE shelters ADD COLUMN IF NOT EXISTS occupancy_disabled_mobility INT NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active'
    CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS occupancy_adults INT NOT NULL DEFAULT 0;
  ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS occupancy_children INT NOT NULL DEFAULT 0;
  ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS occupancy_elderly INT NOT NULL DEFAULT 0;
  ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS occupancy_disabled_mobility INT NOT NULL DEFAULT 0;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

COMMENT ON COLUMN hospitals.operational_mode IS 'Modo operativo del centro: active, limited, saturated, inactive, emergency_only';
COMMENT ON COLUMN shelters.operational_mode IS 'Modo operativo del centro: active, limited, saturated, inactive, emergency_only';
COMMENT ON COLUMN supply_centers.operational_mode IS 'Modo operativo del centro: active, limited, saturated, inactive, emergency_only';

-- ============================================================
-- 2. Tabla center_resources (niveles en tiempo real)
-- ============================================================
CREATE TABLE IF NOT EXISTS center_resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('water', 'medicine', 'food', 'beds', 'personnel')),
  current_level INT NOT NULL DEFAULT 0,
  max_level   INT NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'unidades',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_center_resources_center ON center_resources(center_id);
CREATE INDEX IF NOT EXISTS idx_center_resources_type ON center_resources(center_id, resource_type);

-- ============================================================
-- 3. Tabla support_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS support_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     TEXT NOT NULL,
  request_type  TEXT NOT NULL CHECK (request_type IN ('volunteers', 'medical', 'logistics', 'transport', 'supplies')),
  title         TEXT NOT NULL,
  description   TEXT,
  urgency       TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  quantity      INT NOT NULL DEFAULT 1,
  duration_hours INT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fulfilled', 'cancelled')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_center ON support_requests(center_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_urgency ON support_requests(urgency) WHERE status = 'open';

-- ============================================================
-- 4. Tabla center_events (eventos operativos del centro)
-- ============================================================
CREATE TABLE IF NOT EXISTS center_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'capacity_updated', 'resource_updated', 'case_accepted',
    'case_rejected', 'case_resolved', 'support_requested',
    'operational_mode_changed'
  )),
  previous_value TEXT,
  new_value     TEXT,
  actor_id      TEXT,
  actor_name    TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_center_events_center ON center_events(center_id);
CREATE INDEX IF NOT EXISTS idx_center_events_type ON center_events(event_type);
CREATE INDEX IF NOT EXISTS idx_center_events_created ON center_events(center_id, created_at DESC);

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE center_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_events ENABLE ROW LEVEL SECURITY;

-- Todos los roles operativos pueden leer recursos/eventos
CREATE POLICY center_resources_select ON center_resources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY center_resources_insert ON center_resources
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

CREATE POLICY center_resources_update ON center_resources
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

-- Support requests: el coordinador puede gestionar las de su centro
CREATE POLICY support_requests_select ON support_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY support_requests_insert ON support_requests
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

CREATE POLICY support_requests_update ON support_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'regional_admin', 'super_admin')
  ));

-- Center events: lectura para roles operativos, inserción desde servicios
CREATE POLICY center_events_select ON center_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY center_events_insert ON center_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

-- ============================================================
-- 6. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE center_resources;
ALTER PUBLICATION supabase_realtime ADD TABLE support_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE center_events;

-- ============================================================
-- 7. Comentarios
-- ============================================================
COMMENT ON TABLE center_resources IS 'Niveles de recursos del centro en tiempo real (agua, medicina, alimentos, camas, personal)';
COMMENT ON TABLE support_requests IS 'Solicitudes de apoyo creadas por centros (voluntarios, médicos, logística, transporte, insumos)';
COMMENT ON TABLE center_events IS 'Eventos operativos del centro: cambios de capacidad, recursos, casos, modo operativo';
COMMENT ON COLUMN support_requests.urgency IS 'Urgencia de la solicitud: low, medium, high, critical';
COMMENT ON COLUMN support_requests.status IS 'Estado: open, in_progress, fulfilled, cancelled';
