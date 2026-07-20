-- FARO — Operations Hub V1: Core tables for case management
-- ============================================================
-- Crea el esquema de datos del gestor de casos: máquina de estados,
-- eventos de dominio, asignaciones, y políticas RLS.
-- Las reglas de transición se validan en la capa de dominio (TypeScript),
-- no en la base de datos, para mantener la lógica de negocio testeable
-- y portable. La BD actúa como almacén de estados y eventos.
-- ============================================================

-- ============================================================
-- 1. Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pipeline_stage AS ENUM (
    'nuevo',
    'pending_review',
    'validating',
    'awaiting_info',
    'assigned',
    'accepted',
    'in_attention',
    'resolved',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE case_priority AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE case_event_type AS ENUM (
    'case_submitted',
    'case_review_started',
    'case_validated',
    'case_info_requested',
    'case_info_received',
    'case_assigned',
    'case_accepted',
    'case_attention_started',
    'case_resolved',
    'case_reopened',
    'case_closed',
    'case_dismissed',
    'case_stale_archived',
    'case_unable_to_assign'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM (
    'active',
    'accepted',
    'rejected',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Tabla cases
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  priority      case_priority NOT NULL DEFAULT 'medium',
  pipeline_stage pipeline_stage NOT NULL DEFAULT 'nuevo',

  -- Ubicación
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  address       TEXT,
  zone          TEXT NOT NULL DEFAULT '',

  -- Datos del caso
  affected_count INTEGER NOT NULL DEFAULT 1,
  reporter_name   TEXT,
  reporter_phone  TEXT,
  reporter_email  TEXT,
  reporter_relationship TEXT,
  category      TEXT,

  -- Asignación
  assigned_to       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_center_id TEXT,
  assigned_at       TIMESTAMPTZ,

  -- SLA
  sla_deadline      TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,

  -- Resolución
  resolved_at       TIMESTAMPTZ,

  -- Metadatos extensibles
  metadata      JSONB NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Tabla case_events (event-sourced timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type  case_event_type NOT NULL,
  from_stage  pipeline_stage,
  to_stage    pipeline_stage,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  comment     TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Tabla case_assignments (historial de asignaciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  center_id     TEXT NOT NULL,
  assigned_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status        assignment_status NOT NULL DEFAULT 'active',
  reason        TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  rejected_at   TIMESTAMPTZ
);

-- ============================================================
-- 5. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cases_pipeline_stage ON cases(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_zone ON cases(zone);
CREATE INDEX IF NOT EXISTS idx_cases_sla_deadline ON cases(sla_deadline) WHERE sla_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_event_type ON case_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_events_created_at ON case_events(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id ON case_assignments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_status ON case_assignments(status);

-- ============================================================
-- 6. Trigger: actualizar updated_at en cases
-- ============================================================
CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_updated_at ON cases;
CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_cases_updated_at();

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cases_select_any ON cases;
DROP POLICY IF EXISTS cases_insert_any ON cases;
DROP POLICY IF EXISTS cases_update_any ON cases;
DROP POLICY IF EXISTS cases_delete_admin ON cases;
DROP POLICY IF EXISTS case_events_select ON case_events;
DROP POLICY IF EXISTS case_events_insert ON case_events;
DROP POLICY IF EXISTS case_assignments_select ON case_assignments;
DROP POLICY IF EXISTS case_assignments_insert ON case_assignments;
DROP POLICY IF EXISTS case_assignments_update ON case_assignments;

-- Policy: case_manager puede leer todos los casos
CREATE POLICY cases_select_any ON cases
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- Policy: case_manager puede crear casos
CREATE POLICY cases_insert_any ON cases
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- Policy: case_manager puede actualizar cualquier caso
-- (la validación de transiciones se hace en la capa de dominio)
CREATE POLICY cases_update_any ON cases
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- Policy: solo admin puede eliminar casos
CREATE POLICY cases_delete_admin ON cases
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('regional_admin', 'super_admin')
    )
  );

-- Case events: cualquier case_manager puede leer/insertar
CREATE POLICY case_events_select ON case_events
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY case_events_insert ON case_events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- Case assignments: cualquier case_manager puede leer/insertar/actualizar
CREATE POLICY case_assignments_select ON case_assignments
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY case_assignments_insert ON case_assignments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY case_assignments_update ON case_assignments
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- ============================================================
-- 8. Realtime (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cases;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE case_events;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE case_assignments;
  END IF;
END $$;

-- ============================================================
-- 9. Comentarios de columna
-- ============================================================
COMMENT ON TABLE cases IS 'Casos del gestor de casos del Operations Hub. La máquina de estados se valida en la capa de dominio (TypeScript).';
COMMENT ON TABLE case_events IS 'Eventos de dominio — timeline completo de cada caso (transiciones, comentarios, cambios).';
COMMENT ON TABLE case_assignments IS 'Historial de asignaciones de casos a centros y gestores.';
COMMENT ON COLUMN cases.pipeline_stage IS 'Estado actual del pipeline. Ver VALID_TRANSITIONS en case-lifecycle.types.ts para reglas de transición.';
COMMENT ON COLUMN cases.sla_deadline IS 'Fecha límite para primera respuesta, calculada según prioridad.';
COMMENT ON COLUMN cases.first_response_at IS 'Momento en que el caso pasó a in_attention (primera atención real).';
COMMENT ON COLUMN cases.metadata IS 'Metadatos extensibles para futuros campos sin migración.';
COMMENT ON COLUMN case_events.from_stage IS 'PipelineStage anterior (NULL si es evento inicial).';
COMMENT ON COLUMN case_events.to_stage IS 'PipelineStage nuevo (NULL si no es una transición de estado).';
