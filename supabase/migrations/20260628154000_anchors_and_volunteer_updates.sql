-- Anchor sites (curated coverage) + volunteer need updates.

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shelters ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN NOT NULL DEFAULT false;

UPDATE hospitals SET is_anchor = true
WHERE name IN (
  'Hospital Universitario de Caracas',
  'Hospital Miguel Pérez Carreño',
  'Hospital Dr. Domingo Luciani'
);

UPDATE shelters SET is_anchor = true
WHERE name IN (
  'Parque del Este - Centro de Damnificados',
  'Polideportivo El Poliedro',
  'Universidad Metropolitana - Refugio temporal'
);

UPDATE supply_centers SET is_anchor = true
WHERE name IN (
  'Centro de Acopio Plaza Venezuela',
  'Centro de Acopio Chacao'
);

DROP POLICY IF EXISTS volunteer_insert_needs ON needs;
CREATE POLICY volunteer_insert_needs
  ON needs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS volunteer_update_needs ON needs;
CREATE POLICY volunteer_update_needs
  ON needs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT INSERT, UPDATE ON TABLE needs TO authenticated;
