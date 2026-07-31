-- FARO — dispatch_mode (modo de despacho) para centros
-- Idempotente y compatible con deploys parciales.

-- ============================================================
-- 1) Columnas + constraints (3 tablas de centros)
-- ============================================================

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'mixed';

ALTER TABLE shelters
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'mixed';

ALTER TABLE supply_centers
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT NOT NULL DEFAULT 'mixed';

ALTER TABLE hospitals
  DROP CONSTRAINT IF EXISTS hospitals_dispatch_mode_check;
ALTER TABLE hospitals
  ADD CONSTRAINT hospitals_dispatch_mode_check
  CHECK (dispatch_mode IN ('brigade', 'needs_volunteers', 'mixed'));

ALTER TABLE shelters
  DROP CONSTRAINT IF EXISTS shelters_dispatch_mode_check;
ALTER TABLE shelters
  ADD CONSTRAINT shelters_dispatch_mode_check
  CHECK (dispatch_mode IN ('brigade', 'needs_volunteers', 'mixed'));

ALTER TABLE supply_centers
  DROP CONSTRAINT IF EXISTS supply_centers_dispatch_mode_check;
ALTER TABLE supply_centers
  ADD CONSTRAINT supply_centers_dispatch_mode_check
  CHECK (dispatch_mode IN ('brigade', 'needs_volunteers', 'mixed'));

-- ============================================================
-- 2) RPC admin_register_center: agregar p_dispatch_mode con DEFAULT
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
  p_notes         TEXT    DEFAULT NULL,
  p_dispatch_mode TEXT    DEFAULT 'mixed'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     UUID;
  v_result JSON;
  v_dispatch TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  PERFORM enforce_rate_limit('admin_register_center', 50, 3600);

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

  v_dispatch := coalesce(nullif(trim(coalesce(p_dispatch_mode, '')), ''), 'mixed');
  IF v_dispatch NOT IN ('brigade', 'needs_volunteers', 'mixed') THEN
    v_dispatch := 'mixed';
  END IF;

  IF p_type = 'hospital' THEN
    INSERT INTO hospitals (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, phone,
      capacity, current_occ,
      notes, status,
      dispatch_mode
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
      'active',
      v_dispatch
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(h.*) INTO v_result FROM hospitals h WHERE h.id = v_id;

  ELSIF p_type = 'shelter' THEN
    INSERT INTO shelters (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, contact_phone,
      capacity, current_occ,
      notes, status,
      dispatch_mode
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
      'active',
      v_dispatch
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(s.*) INTO v_result FROM shelters s WHERE s.id = v_id;

  ELSE
    INSERT INTO supply_centers (
      name, address, municipality, state,
      latitude, longitude,
      contact_name, contact_phone,
      schedule, notes,
      accepts, not_accepts,
      status,
      dispatch_mode
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
      'active',
      v_dispatch
    )
    RETURNING id INTO v_id;
    SELECT row_to_json(sc.*) INTO v_result FROM supply_centers sc WHERE sc.id = v_id;
  END IF;

  PERFORM log_auth_event(
    'admin_register_center',
    NULL,
    jsonb_build_object('site_type', p_type, 'site_id', v_id, 'name', p_name, 'dispatch_mode', v_dispatch)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_register_center(
  TEXT, TEXT, TEXT, TEXT, TEXT,
  DECIMAL, DECIMAL,
  TEXT, TEXT,
  INTEGER, INTEGER,
  TEXT, TEXT,
  TEXT
) TO authenticated;

-- Permitir auditar cambios de dispatch_mode.
ALTER TABLE public.center_events DROP CONSTRAINT IF EXISTS center_events_event_type_check;
ALTER TABLE public.center_events
  ADD CONSTRAINT center_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'capacity_updated'::text,
    'resource_updated'::text,
    'resource_added'::text,
    'resource_removed'::text,
    'inventory_in'::text,
    'inventory_out'::text,
    'case_accepted'::text,
    'case_rejected'::text,
    'case_resolved'::text,
    'support_requested'::text,
    'operational_mode_changed'::text,
    'dispatch_mode_changed'::text
  ]));

-- ============================================================
-- 3) Coordinador: permitir update de shelters también (paridad)
-- ============================================================

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

GRANT UPDATE ON shelters TO authenticated;

