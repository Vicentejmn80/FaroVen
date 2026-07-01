-- Perfil de coordinador ampliado + RLS estricta en needs (solo su sitio).

-- ============================================================
-- 1. Campos de onboarding en coordinator_profiles
-- ============================================================

ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS role_title VARCHAR(255);
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS city_zone VARCHAR(255);
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE coordinator_profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- Permitir refugios como sitio coordinado
ALTER TABLE coordinator_profiles DROP CONSTRAINT IF EXISTS coordinator_profiles_site_type_check;
ALTER TABLE coordinator_profiles ADD CONSTRAINT coordinator_profiles_site_type_check
  CHECK (site_type IN ('hospital', 'supply_center', 'shelter'));

-- ============================================================
-- 2. Coordinadores pueden registrar/actualizar refugios propios
-- ============================================================

DROP POLICY IF EXISTS coordinator_insert_shelters ON shelters;
CREATE POLICY coordinator_insert_shelters ON shelters
  FOR INSERT TO authenticated
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS coordinator_update_own_shelter ON shelters;
CREATE POLICY coordinator_update_own_shelter ON shelters
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'shelter'
    )
  )
  WITH CHECK (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'shelter'
    )
  );

GRANT INSERT, UPDATE ON shelters TO authenticated;

-- ============================================================
-- 3. Needs: solo el coordinador de ESE sitio puede insertar/actualizar
-- ============================================================

DROP POLICY IF EXISTS volunteer_insert_needs ON needs;
DROP POLICY IF EXISTS volunteer_update_needs ON needs;
DROP POLICY IF EXISTS coordinator_insert_own_needs ON needs;
DROP POLICY IF EXISTS coordinator_update_own_needs ON needs;

CREATE POLICY coordinator_insert_own_needs ON needs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = needable_type
        AND cp.site_id = needable_id
        AND cp.onboarding_complete = true
    )
  );

CREATE POLICY coordinator_update_own_needs ON needs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = needable_type
        AND cp.site_id = needable_id
        AND cp.onboarding_complete = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = needable_type
        AND cp.site_id = needable_id
        AND cp.onboarding_complete = true
    )
  );
