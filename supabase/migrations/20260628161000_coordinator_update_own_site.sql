-- Coordinadores pueden actualizar su propio sitio (ej. not_accepts en acopios).

DROP POLICY IF EXISTS coordinator_update_own_hospital ON hospitals;
CREATE POLICY coordinator_update_own_hospital ON hospitals
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'hospital'
    )
  )
  WITH CHECK (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'hospital'
    )
  );

DROP POLICY IF EXISTS coordinator_update_own_supply_center ON supply_centers;
CREATE POLICY coordinator_update_own_supply_center ON supply_centers
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'supply_center'
    )
  )
  WITH CHECK (
    id IN (
      SELECT site_id FROM coordinator_profiles
      WHERE auth_user_id = auth.uid() AND site_type = 'supply_center'
    )
  );

GRANT UPDATE ON hospitals TO authenticated;
GRANT UPDATE ON supply_centers TO authenticated;
