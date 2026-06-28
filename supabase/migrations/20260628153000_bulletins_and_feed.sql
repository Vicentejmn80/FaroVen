-- Verified flash bulletins + public read policies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bulletin_kind') THEN
    CREATE TYPE bulletin_kind AS ENUM (
      'general',
      'person_update',
      'need_alert',
      'distribution'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind bulletin_kind NOT NULL DEFAULT 'general',
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  confidence confidence_level NOT NULL DEFAULT 'high',
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulletins_published_at
  ON bulletins(published_at DESC)
  WHERE is_published = true;

ALTER TABLE bulletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_bulletins ON bulletins;
CREATE POLICY public_read_bulletins
  ON bulletins FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS volunteer_insert_bulletins ON bulletins;
CREATE POLICY volunteer_insert_bulletins
  ON bulletins FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT ON TABLE bulletins TO anon, authenticated;
GRANT INSERT ON TABLE bulletins TO authenticated;

INSERT INTO bulletins (kind, title, body, source_name, confidence, published_at)
SELECT
  'person_update',
  'Actualización verificada',
  'María G. · lesionada leve · Hospital Universitario de Caracas',
  'Cruz Roja',
  'high',
  now() - interval '25 minutes'
WHERE NOT EXISTS (
  SELECT 1 FROM bulletins
  WHERE body = 'María G. · lesionada leve · Hospital Universitario de Caracas'
);

INSERT INTO bulletins (kind, title, body, source_name, confidence, published_at)
SELECT
  'need_alert',
  'Necesidad crítica',
  'Parque del Este: faltan cunas portátiles (8/40). Prioridad bebés.',
  'Coordinación voluntarios',
  'high',
  now() - interval '45 minutes'
WHERE NOT EXISTS (
  SELECT 1 FROM bulletins
  WHERE body = 'Parque del Este: faltan cunas portátiles (8/40). Prioridad bebés.'
);

INSERT INTO bulletins (kind, title, body, source_name, confidence, published_at)
SELECT
  'distribution',
  'Evitar saturar',
  'Centro Plaza Venezuela: no recibir comida cocinada ni ropa sin empaque.',
  'Centro de Acopio Plaza Venezuela',
  'high',
  now() - interval '1 hour'
WHERE NOT EXISTS (
  SELECT 1 FROM bulletins
  WHERE body = 'Centro Plaza Venezuela: no recibir comida cocinada ni ropa sin empaque.'
);

INSERT INTO bulletins (kind, title, body, source_name, confidence, published_at)
SELECT
  'general',
  'Distribución recomendada',
  'Polideportivo El Poliedro tiene capacidad disponible. Priorizar cobijas y pañales.',
  'Protección Civil',
  'medium',
  now() - interval '2 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM bulletins
  WHERE body = 'Polideportivo El Poliedro tiene capacidad disponible. Priorizar cobijas y pañales.'
);
