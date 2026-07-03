-- FARO — Campos extendidos para centros + permisos correctos por rol
-- Idempotente.

-- ============================================================
-- 1. Columnas nuevas para los tres tipos de centro
-- ============================================================

ALTER TABLE hospitals      ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE hospitals      ADD COLUMN IF NOT EXISTS state        TEXT;
ALTER TABLE shelters       ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE shelters       ADD COLUMN IF NOT EXISTS state        TEXT;
ALTER TABLE shelters       ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS state        TEXT;
ALTER TABLE supply_centers ADD COLUMN IF NOT EXISTS notes        TEXT;

-- ============================================================
-- 2. RPC segura: admin_register_center
--    Solo super_admin y regional_admin pueden llamarla.
--    Incluye rate-limit y validaciones completas.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_register_center(
  p_type          TEXT,
  p_name          TEXT,
  p_address       TEXT    DEFAULT NULL,
  p_municipality  TEXT    DEFAULT NULL,
  p_state         TEXT    DEFAULT NULL,
  p_latitude      DECIMAL DEFAULT NULL,
  p_longitude     DECIMAL DEFAULT NULL,
  p_contact_name  TEXT    DEFAULT NULL,
  p_phone         TEXT    DEFAULT NULL,
  p_capacity      INTEGER DEFAULT 100,
  p_current_occ   INTEGER DEFAULT 0,
  p_schedule      TEXT    DEFAULT NULL,
  p_notes         TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     UUID;
  v_result JSON;
BEGIN
  -- Autorización
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Rate limit: máximo 50 registros/hora por admin
  PERFORM enforce_rate_limit('admin_register_center', 50, 3600);

  -- Validaciones básicas
  IF p_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_site_type';
  END IF;

  PERFORM assert_text_bounds(p_name,         'center_name',    2,    255, true);
  PERFORM assert_text_bounds(p_address,      'center_address', 0,    500, false);
  PERFORM assert_text_bounds(p_municipality, 'municipality',   0,    255, false);
  PERFORM assert_text_bounds(p_state,        'state',          0,    255, false);
  PERFORM assert_text_bounds(p_contact_name, 'contact_name',   0,    255, false);
  PERFORM assert_text_bounds(p_phone,        'phone',          0,     50, false);
  PERFORM assert_text_bounds(p_notes,        'notes',          0,   1200, false);

  IF p_latitude  IS NOT NULL AND (p_latitude  < -90  OR p_latitude  > 90)  THEN RAISE EXCEPTION 'invalid_latitude';  END IF;
  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN RAISE EXCEPTION 'invalid_longitude'; END IF;
  IF p_capacity    IS NOT NULL AND p_capacity    < 0 THEN RAISE EXCEPTION 'invalid_capacity';    END IF;
  IF p_current_occ IS NOT NULL AND p_current_occ < 0 THEN RAISE EXCEPTION 'invalid_current_occupancy'; END IF;

  -- Inserción según tipo
  IF p_type = 'hospital' THEN
    INSERT INTO hospitals (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, phone,
      capacity, current_occ,
      notes, status
    ) VALUES (
      trim(p_name),
      nullif(trim(coalesce(p_address,      '')), ''),
      nullif(trim(coalesce(p_municipality, '')), ''),
      nullif(trim(coalesce(p_state,        '')), ''),
      p_latitude, p_longitude,
      nullif(trim(coalesce(p_contact_name, '')), ''),
      nullif(trim(coalesce(p_phone,        '')), ''),
      coalesce(p_capacity, 100),
      coalesce(p_current_occ, 0),
      nullif(trim(coalesce(p_notes, '')), ''),
      'active'
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(h.*) INTO v_result FROM hospitals h WHERE h.id = v_id;

  ELSIF p_type = 'shelter' THEN
    INSERT INTO shelters (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, contact_phone,
      capacity, current_occ,
      notes, status
    ) VALUES (
      trim(p_name),
      nullif(trim(coalesce(p_address,      '')), ''),
      nullif(trim(coalesce(p_municipality, '')), ''),
      nullif(trim(coalesce(p_state,        '')), ''),
      p_latitude, p_longitude,
      nullif(trim(coalesce(p_contact_name, '')), ''),
      nullif(trim(coalesce(p_phone,        '')), ''),
      coalesce(p_capacity, 100),
      coalesce(p_current_occ, 0),
      nullif(trim(coalesce(p_notes, '')), ''),
      'active'
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(s.*) INTO v_result FROM shelters s WHERE s.id = v_id;

  ELSE -- supply_center
    INSERT INTO supply_centers (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, contact_phone,
      schedule, notes,
      accepts, not_accepts,
      status
    ) VALUES (
      trim(p_name),
      nullif(trim(coalesce(p_address,      '')), ''),
      nullif(trim(coalesce(p_municipality, '')), ''),
      nullif(trim(coalesce(p_state,        '')), ''),
      p_latitude, p_longitude,
      nullif(trim(coalesce(p_contact_name, '')), ''),
      nullif(trim(coalesce(p_phone,        '')), ''),
      coalesce(nullif(trim(coalesce(p_schedule, '')), ''), 'Por confirmar'),
      nullif(trim(coalesce(p_notes, '')), ''),
      '{}', '{}',
      'active'
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(sc.*) INTO v_result FROM supply_centers sc WHERE sc.id = v_id;
  END IF;

  -- Audit log
  PERFORM log_auth_event(
    'admin_register_center',
    NULL,
    jsonb_build_object('site_type', p_type, 'site_id', v_id, 'name', p_name)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_register_center(
  TEXT, TEXT, TEXT, TEXT, TEXT,
  DECIMAL, DECIMAL,
  TEXT, TEXT,
  INTEGER, INTEGER,
  TEXT, TEXT
) TO authenticated;

-- ============================================================
-- 3. Confirmar que las políticas INSERT para admins existen
--    (idempotente: ya creadas en phase9, sólo reforzamos).
-- ============================================================

DROP POLICY IF EXISTS regional_admin_insert_hospitals ON hospitals;
CREATE POLICY regional_admin_insert_hospitals ON hospitals
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());

DROP POLICY IF EXISTS regional_admin_insert_shelters ON shelters;
CREATE POLICY regional_admin_insert_shelters ON shelters
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());

DROP POLICY IF EXISTS regional_admin_insert_supply_centers ON supply_centers;
CREATE POLICY regional_admin_insert_supply_centers ON supply_centers
  FOR INSERT TO authenticated
  WITH CHECK (is_elevated_admin());

-- ============================================================
-- 4. Actualizar el trigger validate_center_write
--    para incluir rate-limit en INSERT (antes solo en UPDATE)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_center_write()
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
  IF NEW.capacity IS NOT NULL AND NEW.capacity < 0 THEN
    RAISE EXCEPTION 'invalid_capacity';
  END IF;
  IF NEW.current_occ IS NOT NULL AND NEW.current_occ < 0 THEN
    RAISE EXCEPTION 'invalid_current_occupancy';
  END IF;

  RETURN NEW;
END;
$$;
