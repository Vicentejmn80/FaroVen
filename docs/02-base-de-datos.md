# BASE DE DATOS — PostgreSQL en Supabase

## Diagrama de Entidades (Texto)

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│    roles    │     │   persons     │     │  hospitals   │
├─────────────┤     ├───────────────┤     ├──────────────┤
│ id          │◄────│ volunteer_id  │     │ id           │
│ name        │     │ name          │     │ name         │
│ permissions │     │ first_name    │     │ address      │
└─────────────┘     │ last_name     │     │ phone        │
                    │ full_name_ts  │     │ latitude     │
┌─────────────┐     │ status        │     │ longitude    │
│   users     │     │ hospital_id   │────►│ status       │
├─────────────┤     │ shelter_id    │     │ capacity     │
│ id          │     │ confidence    │     │ current_occ  │
│ email       │     │ source_id     │     │ contact_name │
│ name        │     │ notes         │     │ created_at   │
│ role_id     │────►│ reported_at   │     │ updated_at   │
│ is_active   │     │ updated_at    │     └──────────────┘
│ created_at  │     │ deleted_at    │
│ last_login  │     └───────────────┘     ┌──────────────┐
└─────────────┘                           │  shelters    │
                    ┌───────────────┐     ├──────────────┤
                    │   sources     │     │ id           │
                    ├───────────────┤     │ name         │
                    │ id            │     │ address      │
                    │ name          │     │ latitude     │
                    │ type          │     │ longitude    │
                    │ confidence    │     │ capacity     │
                    │ contact       │     │ current_occ  │
                    │ is_active     │     │ contact_name │
                    │ created_at    │     │ contact_phone│
                    └───────────────┘     │ status       │
                                          │ created_at   │
┌──────────────┐     ┌───────────────┐     │ updated_at   │
│ supply_cntrs │     │   needs       │     └──────────────┘
├──────────────┤     ├───────────────┤
│ id           │     │ id            │     ┌──────────────┐
│ name         │     │ needable_type │     │  reports     │
│ address      │     │ needable_id   │     ├──────────────┤
│ latitude     │     │ item_name     │     │ id           │
│ longitude    │     │ priority      │     │ type         │
│ schedule     │     │ qty_required  │     │ description  │
│ accepts      │     │ qty_received  │     │ person_id    │
│ not_accepts  │     │ unit          │     │ reported_by  │
│ contact_name │     │ pct_covered   │     │ contact_info │
│ contact_phone│     │ updated_at    │     │ attachment   │
│ status       │     │ updated_by    │     │ status       │
│ created_at   │     └───────────────┘     │ reviewed_by  │
│ updated_at   │                           │ reviewed_at  │
└──────────────┘     ┌───────────────┐     │ created_at   │
                     │  updates      │     └──────────────┘
┌──────────────┐     ├───────────────┤
│ attachments  │     │ id            │     ┌──────────────┐
├──────────────┤     │ table_name    │     │ audit_logs   │
│ id           │     │ record_id     │     ├──────────────┤
│ update_id    │────►│ field         │     │ id           │
│ report_id    │     │ old_value     │     │ table_name   │
│ file_path    │     │ new_value     │     │ record_id    │
│ file_type    │     │ changed_by    │     │ action       │
│ file_size    │     │ status        │     │ actor_id     │
│ uploaded_by  │     │ reviewed_by   │     │ ip_address   │
│ created_at   │     │ reviewed_at   │     │ user_agent   │
└──────────────┘     │ created_at    │     │ metadata     │
                     └───────────────┘     │ created_at   │
                                           └──────────────┘
```

## Migración SQL Completa

```sql
-- ============================================================
-- 000_initial_schema.sql
-- ============================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. TIPO ENUM
CREATE TYPE person_status AS ENUM (
  'safe',           -- localizado sano y salvo
  'injured',        -- lesionado / hospitalizado
  'transferred',    -- trasladado a otro centro
  'deceased',       -- fallecido (solo con confirmación oficial)
  'unknown'         -- estado no determinado aún (default)
);

CREATE TYPE source_type AS ENUM (
  'hospital',
  'shelter',
  'government',
  'civil_protection',
  'red_cross',
  'ngo',
  'official_list'
);

CREATE TYPE confidence_level AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE need_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

CREATE TYPE update_status AS ENUM (
  'pending_review',
  'approved',
  'rejected'
);

CREATE TYPE report_type AS ENUM (
  'wrong_info',
  'person_found',
  'person_transferred',
  'hospital_changed',
  'need_covered',
  'other'
);

CREATE TYPE report_status AS ENUM (
  'pending',
  'under_review',
  'verified',
  'dismissed'
);

-- 3. TABLAS

-- roles
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users (vinculado a Supabase Auth)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE,  -- referencia a auth.users de Supabase
  email           VARCHAR(255) UNIQUE NOT NULL,
  full_name       VARCHAR(255),
  phone           VARCHAR(50),
  role_id         UUID NOT NULL REFERENCES roles(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sources (fuentes de información)
CREATE TABLE sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  type        source_type NOT NULL,
  confidence  confidence_level NOT NULL DEFAULT 'medium',
  contact     VARCHAR(255),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- hospitals
CREATE TABLE hospitals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  phone         VARCHAR(50),
  contact_name  VARCHAR(255),
  capacity      INTEGER,
  current_occ   INTEGER DEFAULT 0,
  status        VARCHAR(50) NOT NULL DEFAULT 'active',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shelters
CREATE TABLE shelters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  capacity        INTEGER,
  current_occ     INTEGER DEFAULT 0,
  contact_name    VARCHAR(255),
  contact_phone   VARCHAR(50),
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- supply_centers
CREATE TABLE supply_centers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  address         TEXT,
  latitude        DECIMAL(10,7),
  longitude       DECIMAL(10,7),
  schedule        TEXT,
  accepts         TEXT[],       -- qué reciben
  not_accepts     TEXT[],       -- qué NO necesitan
  contact_name    VARCHAR(255),
  contact_phone   VARCHAR(50),
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- persons (registro central)
CREATE TABLE persons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      VARCHAR(150) NOT NULL,
  last_name       VARCHAR(150) NOT NULL,
  full_name_ts    TSVECTOR,                    -- para búsqueda full-text
  status          person_status NOT NULL DEFAULT 'unknown',
  hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  shelter_id      UUID REFERENCES shelters(id) ON DELETE SET NULL,
  confidence      confidence_level NOT NULL DEFAULT 'medium',
  source_id       UUID REFERENCES sources(id) ON DELETE SET NULL,
  notes           TEXT,
  reported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ                  -- soft delete
);

-- needs (necesidades polimórficas: hospitales, refugios)
CREATE TABLE needs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  needable_type   VARCHAR(50) NOT NULL,           -- 'hospital', 'shelter'
  needable_id     UUID NOT NULL,
  item_name       VARCHAR(255) NOT NULL,
  priority        need_priority NOT NULL DEFAULT 'medium',
  qty_required    INTEGER NOT NULL DEFAULT 0,
  qty_received    INTEGER NOT NULL DEFAULT 0,
  unit            VARCHAR(50) NOT NULL DEFAULT 'units',
  pct_covered     DECIMAL(5,2) GENERATED ALWAYS AS (
                    CASE WHEN qty_required > 0
                      THEN ROUND((qty_received::DECIMAL / qty_required) * 100, 2)
                      ELSE 0
                    END
                  ) STORED,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- updates (versionado de cambios)
CREATE TABLE updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      VARCHAR(100) NOT NULL,       -- 'persons', 'hospitals', etc.
  record_id       UUID NOT NULL,
  field           VARCHAR(100),
  old_value       TEXT,
  new_value       TEXT,
  changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  status          update_status NOT NULL DEFAULT 'pending_review',
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reports (reportes ciudadanos)
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            report_type NOT NULL,
  description     TEXT NOT NULL,
  person_id       UUID REFERENCES persons(id) ON DELETE SET NULL,
  reported_by     VARCHAR(255),                -- nombre de quien reporta
  contact_info    VARCHAR(255),                -- email o teléfono opcional
  attachment_url  TEXT,
  status          report_status NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- attachments (archivos adjuntos)
CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id       UUID REFERENCES updates(id) ON DELETE CASCADE,
  report_id       UUID REFERENCES reports(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  file_type       VARCHAR(50) NOT NULL,         -- 'image/jpeg', 'application/pdf'
  file_size       INTEGER,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_ref CHECK (
    (update_id IS NOT NULL OR report_id IS NOT NULL)
  )
);

-- audit_logs
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      VARCHAR(100) NOT NULL,
  record_id       UUID,
  action          VARCHAR(50) NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE'
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 001_search_indexes.sql
-- ============================================================

-- Índices para búsqueda de personas
CREATE INDEX idx_persons_full_name_ts ON persons USING GIN(full_name_ts);
CREATE INDEX idx_persons_first_name ON persons USING GIN(first_name gin_trgm_ops);
CREATE INDEX idx_persons_last_name ON persons USING GIN(last_name gin_trgm_ops);
CREATE INDEX idx_persons_status ON persons(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_persons_hospital ON persons(hospital_id) WHERE hospital_id IS NOT NULL;
CREATE INDEX idx_persons_shelter ON persons(shelter_id) WHERE shelter_id IS NOT NULL;
CREATE INDEX idx_persons_deleted ON persons(deleted_at) WHERE deleted_at IS NOT NULL;

-- Índices para búsqueda general
CREATE INDEX idx_hospitals_name ON hospitals USING GIN(name gin_trgm_ops);
CREATE INDEX idx_hospitals_status ON hospitals(status);
CREATE INDEX idx_shelters_name ON shelters USING GIN(name gin_trgm_ops);
CREATE INDEX idx_supply_centers_name ON supply_centers USING GIN(name gin_trgm_ops);
CREATE INDEX idx_needs_priority ON needs(priority);
CREATE INDEX idx_needs_polymorphic ON needs(needable_type, needable_id);
CREATE INDEX idx_updates_status ON updates(status);
CREATE INDEX idx_updates_changed_by ON updates(changed_by);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);

-- ============================================================
-- 002_rls_policies.sql
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- === VISITANTE (usuario anónimo / no autenticado) ===

-- persons: solo lectura de registros activos (no eliminados)
CREATE POLICY "Visitantes pueden leer persons activos"
  ON persons FOR SELECT
  USING (deleted_at IS NULL AND status IS NOT NULL);

-- hospitals: solo lectura
CREATE POLICY "Visitantes pueden leer hospitals"
  ON hospitals FOR SELECT
  USING (status = 'active');

-- shelters: solo lectura
CREATE POLICY "Visitantes pueden leer shelters"
  ON shelters FOR SELECT
  USING (status = 'active');

-- supply_centers: solo lectura
CREATE POLICY "Visitantes pueden leer supply_centers"
  ON supply_centers FOR SELECT
  USING (status = 'active');

-- needs: solo lectura
CREATE POLICY "Visitantes pueden leer needs"
  ON needs FOR SELECT
  USING (true);

-- reports: INSERT para visitantes (reportar error)
CREATE POLICY "Visitantes pueden crear reports"
  ON reports FOR INSERT
  WITH CHECK (true);

-- === VOLUNTARIO ===

-- persons: puede leer todos (incluso eliminados) y crear updates
CREATE POLICY "Voluntarios pueden leer persons"
  ON persons FOR SELECT
  USING (true);

-- updates: voluntarios pueden INSERT y SELECT
CREATE POLICY "Voluntarios pueden crear updates"
  ON updates FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name IN ('volunteer', 'admin')))
  );

CREATE POLICY "Voluntarios pueden leer sus updates"
  ON updates FOR SELECT
  USING (true);

-- needs: voluntarios pueden actualizar (genera update pendiente)
CREATE POLICY "Voluntarios pueden actualizar needs"
  ON needs FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- attachments: voluntarios pueden subir
CREATE POLICY "Voluntarios pueden subir attachments"
  ON attachments FOR INSERT
  WITH CHECK (true);

-- === ADMINISTRADOR ===

-- Todo: full access
CREATE POLICY "Admin full access persons"
  ON persons FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Admin full access updates"
  ON updates FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Admin full access users"
  ON users FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Admin full access reports"
  ON reports FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Admin full access audit_logs"
  ON audit_logs FOR ALL
  USING (
    auth.uid() IN (SELECT auth_user_id FROM users WHERE role_id IN
      (SELECT id FROM roles WHERE name = 'admin'))
  );

-- ============================================================
-- 003_triggers_audit.sql
-- ============================================================

-- Función: actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trg_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shelters_updated_at
  BEFORE UPDATE ON shelters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_supply_centers_updated_at
  BEFORE UPDATE ON supply_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Función: generar tsvector para búsqueda full-text
CREATE OR REPLACE FUNCTION persons_set_full_name_ts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name_ts = to_tsvector('spanish',
    coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_persons_full_name_ts
  BEFORE INSERT OR UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION persons_set_full_name_ts();

-- Función: audit_log automático
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
BEGIN
  -- Intentar obtener el usuario desde auth.users
  v_actor_id := (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1);

  INSERT INTO audit_logs (
    table_name, record_id, action, actor_id,
    ip_address, metadata
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    v_actor_id,
    inet_client_addr(),
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar audit_log a tablas críticas
CREATE TRIGGER trg_audit_persons
  AFTER INSERT OR UPDATE OR DELETE ON persons
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trg_audit_hospitals
  AFTER INSERT OR UPDATE OR DELETE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trg_audit_shelters
  AFTER INSERT OR UPDATE OR DELETE ON shelters
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trg_audit_needs
  AFTER INSERT OR UPDATE OR DELETE ON needs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- 004_seed_data.sql
-- ============================================================

-- Insertar roles base
INSERT INTO roles (name, description) VALUES
  ('admin', 'Acceso completo al sistema'),
  ('volunteer', 'Puede actualizar registros y cargar listas'),
  ('viewer', 'Solo lectura (visitante autenticado)');

-- Insertar fuentes base
INSERT INTO sources (name, type, confidence) VALUES
  ('Cruz Roja', 'red_cross', 'high'),
  ('Protección Civil', 'civil_protection', 'high'),
  ('Secretaría de Salud', 'government', 'high'),
  ('Hospital General', 'hospital', 'high'),
  ('Reporte Voluntario', 'ngo', 'low');
```

## Funciones de Búsqueda

```sql
-- search_person: busca por nombre y apellido
CREATE OR REPLACE FUNCTION search_person(
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  first_name VARCHAR,
  last_name VARCHAR,
  status person_status,
  hospital_name VARCHAR,
  shelter_name VARCHAR,
  confidence confidence_level,
  source_name VARCHAR,
  updated_at TIMESTAMPTZ,
  notes TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.status,
    h.name AS hospital_name,
    s.name AS shelter_name,
    p.confidence,
    src.name AS source_name,
    p.updated_at,
    p.notes,
    ts_rank(p.full_name_ts, to_tsquery('spanish',
      coalesce(p_first_name, '') || ':* & ' || coalesce(p_last_name, '') || ':*'
    )) AS rank
  FROM persons p
  LEFT JOIN hospitals h ON p.hospital_id = h.id
  LEFT JOIN shelters s ON p.shelter_id = s.id
  LEFT JOIN sources src ON p.source_id = src.id
  WHERE p.deleted_at IS NULL
    AND (
      (p_first_name IS NULL OR p.first_name % p_first_name)
      OR (p_last_name IS NULL OR p.last_name % p_last_name)
      OR p.full_name_ts @@ to_tsquery('spanish',
           coalesce(p_first_name, '') || ':* & ' || coalesce(p_last_name, '') || ':*'
         )
    )
  ORDER BY rank DESC, p.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```
