-- FARO consola pública: registro ciudadano de sitios y necesidades (sin auth).
-- Complementa políticas de coordinador; no las reemplaza.

DROP POLICY IF EXISTS public_insert_hospitals ON hospitals;
CREATE POLICY public_insert_hospitals
  ON hospitals FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS public_insert_shelters ON shelters;
CREATE POLICY public_insert_shelters
  ON shelters FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS public_insert_supply_centers ON supply_centers;
CREATE POLICY public_insert_supply_centers
  ON supply_centers FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS public_insert_needs ON needs;
CREATE POLICY public_insert_needs
  ON needs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS public_update_needs ON needs;
CREATE POLICY public_update_needs
  ON needs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS public_update_hospitals ON hospitals;
CREATE POLICY public_update_hospitals
  ON hospitals FOR UPDATE
  TO anon, authenticated
  USING (status = 'active')
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS public_update_shelters ON shelters;
CREATE POLICY public_update_shelters
  ON shelters FOR UPDATE
  TO anon, authenticated
  USING (status = 'active')
  WITH CHECK (status = 'active');

DROP POLICY IF EXISTS public_update_supply_centers ON supply_centers;
CREATE POLICY public_update_supply_centers
  ON supply_centers FOR UPDATE
  TO anon, authenticated
  USING (status = 'active')
  WITH CHECK (status = 'active');

GRANT INSERT ON hospitals, shelters, supply_centers TO anon;
GRANT INSERT, UPDATE ON needs TO anon;
GRANT UPDATE ON hospitals, shelters, supply_centers TO anon;

-- Reportes ciudadanos (anon) sobre centros registrados.
DROP POLICY IF EXISTS anon_insert_reports ON reports;
CREATE POLICY anon_insert_reports
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND site_type IS NOT NULL
    AND site_id IS NOT NULL
    AND site_type IN ('hospital', 'shelter', 'supply_center')
  );

DROP POLICY IF EXISTS public_read_reports ON reports;
CREATE POLICY public_read_reports
  ON reports FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT INSERT, SELECT ON reports TO anon;
GRANT INSERT, SELECT ON reports TO authenticated;

-- Evento al registrar un sitio nuevo (los UPDATE ya tenían trigger).
CREATE OR REPLACE FUNCTION log_event_from_center_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'center_opened',
    NEW.name || ' registrado',
    coalesce(NEW.address, 'Nuevo punto operativo en el mapa'),
    'operational',
    TG_ARGV[0],
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_hospitals_insert_event ON hospitals;
CREATE TRIGGER trg_hospitals_insert_event
AFTER INSERT ON hospitals
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center_insert('hospital');

DROP TRIGGER IF EXISTS trg_shelters_insert_event ON shelters;
CREATE TRIGGER trg_shelters_insert_event
AFTER INSERT ON shelters
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center_insert('shelter');

DROP TRIGGER IF EXISTS trg_supply_centers_insert_event ON supply_centers;
CREATE TRIGGER trg_supply_centers_insert_event
AFTER INSERT ON supply_centers
FOR EACH ROW
EXECUTE FUNCTION log_event_from_center_insert('supply_center');
