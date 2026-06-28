-- Core schema reconciliation migration
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_status') THEN
    CREATE TYPE person_status AS ENUM ('safe', 'injured', 'transferred', 'deceased', 'unknown');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confidence_level') THEN
    CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE source_type AS ENUM ('hospital', 'shelter', 'government', 'civil_protection', 'red_cross', 'ngo', 'official_list');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'need_priority') THEN
    CREATE TYPE need_priority AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'update_status') THEN
    CREATE TYPE update_status AS ENUM ('pending_review', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
    CREATE TYPE report_type AS ENUM ('wrong_info', 'person_found', 'person_transferred', 'hospital_changed', 'need_covered', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'verified', 'dismissed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type source_type NOT NULL DEFAULT 'official_list',
  confidence confidence_level NOT NULL DEFAULT 'medium',
  contact VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  phone VARCHAR(50),
  contact_name VARCHAR(255),
  capacity INTEGER,
  current_occ INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS current_occ INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Reconcile manually-created hospitals table: id is often INTEGER, schema expects UUID.
DO $$
DECLARE
  hospitals_id_type TEXT;
BEGIN
  SELECT c.data_type
  INTO hospitals_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'hospitals'
    AND c.column_name = 'id';

  IF hospitals_id_type IS NOT NULL AND hospitals_id_type <> 'uuid' THEN
    ALTER TABLE hospitals DROP CONSTRAINT IF EXISTS hospitals_pkey;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'hospitals'
        AND c.column_name = 'id_uuid'
    ) THEN
      ALTER TABLE hospitals ADD COLUMN id_uuid UUID;
      UPDATE hospitals SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'hospitals'
        AND c.column_name = 'id'
        AND c.data_type <> 'uuid'
    ) THEN
      ALTER TABLE hospitals RENAME COLUMN id TO id_legacy;
      ALTER TABLE hospitals RENAME COLUMN id_uuid TO id;
    END IF;

    UPDATE hospitals SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE hospitals ALTER COLUMN id SET NOT NULL;
    ALTER TABLE hospitals ALTER COLUMN id SET DEFAULT gen_random_uuid();

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'hospitals_pkey'
        AND conrelid = 'public.hospitals'::regclass
    ) THEN
      ALTER TABLE hospitals ADD PRIMARY KEY (id);
    END IF;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS shelters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  capacity INTEGER,
  current_occ INTEGER DEFAULT 0,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  schedule TEXT,
  accepts TEXT[],
  not_accepts TEXT[],
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  full_name_ts TSVECTOR,
  status person_status NOT NULL DEFAULT 'unknown',
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  shelter_id UUID REFERENCES shelters(id) ON DELETE SET NULL,
  confidence confidence_level NOT NULL DEFAULT 'medium',
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  notes TEXT,
  reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  needable_type VARCHAR(50) NOT NULL,
  needable_id UUID NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  priority need_priority NOT NULL DEFAULT 'medium',
  qty_required INTEGER NOT NULL DEFAULT 0,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'units',
  pct_covered DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN qty_required > 0 THEN ROUND((qty_received::DECIMAL / qty_required) * 100, 2)
      ELSE 0
    END
  ) STORED,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status update_status NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type report_type NOT NULL,
  description TEXT NOT NULL,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  reported_by VARCHAR(255),
  contact_info VARCHAR(255),
  attachment_url TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persons_full_name_ts ON persons USING GIN(full_name_ts);
CREATE INDEX IF NOT EXISTS idx_persons_first_name ON persons USING GIN(first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_persons_last_name ON persons USING GIN(last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shelters_name ON shelters USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_supply_centers_name ON supply_centers USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_needs_priority ON needs(priority);
CREATE INDEX IF NOT EXISTS idx_needs_polymorphic ON needs(needable_type, needable_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hospitals_updated_at ON hospitals;
CREATE TRIGGER trg_hospitals_updated_at
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_shelters_updated_at ON shelters;
CREATE TRIGGER trg_shelters_updated_at
  BEFORE UPDATE ON shelters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_supply_centers_updated_at ON supply_centers;
CREATE TRIGGER trg_supply_centers_updated_at
  BEFORE UPDATE ON supply_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_persons_updated_at ON persons;
CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION persons_set_full_name_ts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name_ts = to_tsvector('spanish', coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_persons_full_name_ts ON persons;
CREATE TRIGGER trg_persons_full_name_ts
  BEFORE INSERT OR UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION persons_set_full_name_ts();

INSERT INTO roles (name, description)
VALUES
  ('admin', 'Acceso completo al sistema'),
  ('volunteer', 'Puede actualizar registros y cargar listas'),
  ('viewer', 'Solo lectura (visitante autenticado)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO sources (name, type, confidence)
SELECT 'Cruz Roja', 'red_cross', 'high'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE name = 'Cruz Roja');

INSERT INTO sources (name, type, confidence)
SELECT 'Proteccion Civil', 'civil_protection', 'high'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE name = 'Proteccion Civil');

INSERT INTO sources (name, type, confidence)
SELECT 'Secretaria de Salud', 'government', 'high'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE name = 'Secretaria de Salud');

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE persons, hospitals, shelters, supply_centers, needs, sources TO anon, authenticated;
GRANT INSERT ON TABLE reports TO anon, authenticated;
