-- Limpia datos operativos demo; conserva hospitales y centros de acopio.
-- Añade perfiles de coordinador y permisos para registrar sitios.
-- Idempotente: funciona aunque no exista bulletins u otras tablas opcionales.

DO $$
BEGIN
  IF to_regclass('public.bulletins') IS NOT NULL THEN
    DELETE FROM bulletins;
  END IF;

  IF to_regclass('public.needs') IS NOT NULL THEN
    DELETE FROM needs;
  END IF;

  IF to_regclass('public.persons') IS NOT NULL THEN
    DELETE FROM persons;
  END IF;

  IF to_regclass('public.shelters') IS NOT NULL THEN
    DELETE FROM shelters;
  END IF;
END $$;

ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN NOT NULL DEFAULT false;

UPDATE hospitals SET is_anchor = true WHERE status = 'active';
UPDATE supply_centers SET is_anchor = true WHERE status = 'active';

CREATE TABLE IF NOT EXISTS coordinator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  site_type TEXT NOT NULL CHECK (site_type IN ('hospital', 'supply_center')),
  site_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coordinator_profiles_auth ON coordinator_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_profiles_site ON coordinator_profiles(site_type, site_id);

ALTER TABLE coordinator_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coordinator_profiles_select_own ON coordinator_profiles;
CREATE POLICY coordinator_profiles_select_own ON coordinator_profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS coordinator_profiles_insert_own ON coordinator_profiles;
CREATE POLICY coordinator_profiles_insert_own ON coordinator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS coordinator_profiles_update_own ON coordinator_profiles;
CREATE POLICY coordinator_profiles_update_own ON coordinator_profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON coordinator_profiles TO authenticated;

DROP POLICY IF EXISTS coordinator_insert_hospitals ON hospitals;
CREATE POLICY coordinator_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS coordinator_insert_supply_centers ON supply_centers;
CREATE POLICY coordinator_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (status = 'active');

GRANT INSERT ON hospitals TO authenticated;
GRANT INSERT ON supply_centers TO authenticated;

-- Permisos de needs para coordinadores (por si no corrió migración 154000)
DO $$
BEGIN
  IF to_regclass('public.needs') IS NOT NULL THEN
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
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_needs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.needs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_needs_updated_at ON needs;
    CREATE TRIGGER trg_needs_updated_at
      BEFORE UPDATE ON needs
      FOR EACH ROW
      EXECUTE FUNCTION set_needs_updated_at();
  END IF;
END $$;
