-- Fix: validate_center_write referenced capacity/current_occ on supply_centers,
-- which do not exist on that table → 400 on INSERT.

CREATE OR REPLACE FUNCTION validate_supply_center_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('center_insert', 50, 3600);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM enforce_rate_limit('center_update', 500, 3600);
  END IF;

  PERFORM assert_text_bounds(NEW.name,    'center_name',    2,    255, true);
  PERFORM assert_text_bounds(NEW.address, 'center_address', 0,    500, false);
  PERFORM assert_text_bounds(NEW.notes,   'center_notes',   0,   1200, false);

  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'invalid_latitude';
  END IF;
  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'invalid_longitude';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supply_center_write ON supply_centers;
CREATE TRIGGER trg_validate_supply_center_write
  BEFORE INSERT OR UPDATE ON supply_centers
  FOR EACH ROW
  EXECUTE FUNCTION validate_supply_center_write();
