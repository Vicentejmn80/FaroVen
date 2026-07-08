-- FARO — Ciclo Operativo de Necesidades
-- Introduce ciclo obligatorio, estado operativo y historial por ciclo.

-- ============================================================
-- 1. Tipos
-- ============================================================
DO $$ BEGIN
  CREATE TYPE need_cycle_status AS ENUM ('active', 'pending_closure', 'resolved', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE need_cycle_outcome AS ENUM ('resolved', 'reopened', 'no_resources', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Configuracion operativa
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_settings (
  key TEXT PRIMARY KEY,
  value_int INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE operational_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_settings_read ON operational_settings;
CREATE POLICY operational_settings_read
  ON operational_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS operational_settings_write ON operational_settings;
CREATE POLICY operational_settings_write
  ON operational_settings FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS operational_settings_insert ON operational_settings;
CREATE POLICY operational_settings_insert
  ON operational_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

INSERT INTO operational_settings (key, value_int)
VALUES ('need_cycle_duration_hours', 24)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. Campos ciclo en necesidades
-- ============================================================
ALTER TABLE needs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE needs ADD COLUMN IF NOT EXISTS status need_cycle_status NOT NULL DEFAULT 'active';
ALTER TABLE needs ADD COLUMN IF NOT EXISTS cycle_duration_hours INT NOT NULL DEFAULT 24;
ALTER TABLE needs ADD COLUMN IF NOT EXISTS cycle_number INT NOT NULL DEFAULT 1;
ALTER TABLE needs ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE needs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE needs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE needs ADD COLUMN IF NOT EXISTS closure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_needs_cycle_status ON needs(status);
CREATE INDEX IF NOT EXISTS idx_needs_expires_at ON needs(expires_at);

UPDATE needs
SET
  created_at = COALESCE(created_at, updated_at, now()),
  cycle_duration_hours = COALESCE(
    cycle_duration_hours,
    (SELECT value_int FROM operational_settings WHERE key = 'need_cycle_duration_hours'),
    24
  ),
  cycle_number = COALESCE(cycle_number, 1),
  status = COALESCE(
    status,
    CASE
      WHEN qty_required > 0 AND qty_received >= qty_required THEN 'resolved'::need_cycle_status
      ELSE 'active'::need_cycle_status
    END
  ),
  cycle_started_at = COALESCE(cycle_started_at, created_at, updated_at, now()),
  expires_at = COALESCE(
    expires_at,
    COALESCE(cycle_started_at, created_at, updated_at, now())
      + make_interval(hours => COALESCE(cycle_duration_hours, 24))
  );

-- ============================================================
-- 4. Historial de ciclos
-- ============================================================
CREATE TABLE IF NOT EXISTS need_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_hours INT NOT NULL,
  qty_required INT NOT NULL,
  qty_received INT NOT NULL,
  qty_missing INT NOT NULL,
  outcome need_cycle_outcome NOT NULL,
  closure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_need_cycles_need ON need_cycles(need_id, cycle_number DESC);

ALTER TABLE need_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS need_cycles_read ON need_cycles;
CREATE POLICY need_cycles_read
  ON need_cycles FOR SELECT
  TO authenticated
  USING (
    is_elevated_admin()
    OR EXISTS (
      SELECT 1
      FROM needs n
      JOIN coordinator_profiles cp
        ON cp.auth_user_id = auth.uid()
       AND cp.site_type = n.needable_type
       AND cp.site_id = n.needable_id
       AND cp.onboarding_complete = true
      WHERE n.id = need_cycles.need_id
    )
  );

-- ============================================================
-- 5. Defaults de ciclo al crear necesidad
-- ============================================================
CREATE OR REPLACE FUNCTION set_need_cycle_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration INT;
BEGIN
  SELECT value_int INTO v_duration
  FROM operational_settings
  WHERE key = 'need_cycle_duration_hours';

  IF v_duration IS NULL THEN
    v_duration := 24;
  END IF;

  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.cycle_duration_hours := COALESCE(NEW.cycle_duration_hours, v_duration);
  NEW.cycle_number := COALESCE(NEW.cycle_number, 1);
  NEW.status := COALESCE(NEW.status, 'active');
  NEW.cycle_started_at := COALESCE(NEW.cycle_started_at, NEW.created_at);
  NEW.expires_at := COALESCE(
    NEW.expires_at,
    NEW.cycle_started_at + make_interval(hours => NEW.cycle_duration_hours)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_need_cycle_defaults ON needs;
CREATE TRIGGER trg_need_cycle_defaults
  BEFORE INSERT ON needs
  FOR EACH ROW
  EXECUTE FUNCTION set_need_cycle_defaults();

-- ============================================================
-- 6. Refrescar ciclos vencidos => PENDING_CLOSURE
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_need_cycles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  FOR v_row IN
    SELECT n.id, n.needable_type, n.needable_id, n.item_name, n.qty_required, n.qty_received
    FROM needs n
    WHERE n.status IN ('active', 'reopened')
      AND n.expires_at IS NOT NULL
      AND n.expires_at <= now()
      AND (
        is_elevated_admin()
        OR EXISTS (
          SELECT 1
          FROM coordinator_profiles cp
          WHERE cp.auth_user_id = auth.uid()
            AND cp.site_type = n.needable_type
            AND cp.site_id = n.needable_id
            AND cp.onboarding_complete = true
        )
      )
  LOOP
    UPDATE needs
    SET status = 'pending_closure',
        updated_at = now()
    WHERE id = v_row.id
      AND status IN ('active', 'reopened');

    IF FOUND THEN
      v_count := v_count + 1;
      PERFORM notify_site_coordinators(
        v_row.needable_type,
        v_row.needable_id,
        'need_cycle_expired',
        'Actualizacion pendiente',
        v_row.item_name || ' requiere registrar el resultado del ciclo.',
        'high',
        'tab:ops:needs',
        jsonb_build_object(
          'need_id', v_row.id,
          'qty_required', v_row.qty_required,
          'qty_received', v_row.qty_received
        )
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_need_cycles() TO authenticated;

-- ============================================================
-- 7. Cerrar ciclo operativo
-- ============================================================
CREATE OR REPLACE FUNCTION close_need_cycle(
  p_need_id UUID,
  p_received_qty INT,
  p_continue BOOLEAN,
  p_closure_reason TEXT DEFAULT NULL
)
RETURNS needs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_need needs%ROWTYPE;
  v_total_received INT;
  v_remaining INT;
  v_outcome need_cycle_outcome;
  v_next_status need_cycle_status;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_need
  FROM needs
  WHERE id = p_need_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'need_not_found';
  END IF;

  IF NOT is_elevated_admin() THEN
    IF NOT EXISTS (
      SELECT 1
      FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = v_need.needable_type
        AND cp.site_id = v_need.needable_id
        AND cp.onboarding_complete = true
    ) THEN
      RAISE EXCEPTION 'invalid_need_owner';
    END IF;
  END IF;

  v_total_received := GREATEST(v_need.qty_received + GREATEST(p_received_qty, 0), 0);
  v_remaining := GREATEST(v_need.qty_required - v_total_received, 0);

  IF v_total_received >= v_need.qty_required AND v_need.qty_required > 0 THEN
    v_outcome := 'resolved';
    v_next_status := 'resolved';
  ELSIF p_continue THEN
    v_outcome := 'reopened';
    v_next_status := 'reopened';
  ELSE
    v_outcome := CASE WHEN p_received_qty = 0 THEN 'no_resources' ELSE 'resolved' END;
    v_next_status := 'resolved';
  END IF;

  INSERT INTO need_cycles (
    need_id,
    cycle_number,
    started_at,
    ended_at,
    duration_hours,
    qty_required,
    qty_received,
    qty_missing,
    outcome,
    closure_reason
  ) VALUES (
    v_need.id,
    v_need.cycle_number,
    v_need.cycle_started_at,
    v_now,
    v_need.cycle_duration_hours,
    v_need.qty_required,
    v_total_received,
    v_remaining,
    v_outcome,
    p_closure_reason
  );

  IF v_next_status = 'resolved' THEN
    UPDATE needs
    SET status = 'resolved',
        qty_received = v_total_received,
        closed_at = v_now,
        closure_reason = p_closure_reason,
        updated_at = v_now
    WHERE id = v_need.id
    RETURNING * INTO v_need;
  ELSE
    UPDATE needs
    SET status = 'reopened',
        cycle_number = v_need.cycle_number + 1,
        cycle_started_at = v_now,
        qty_required = v_remaining,
        qty_received = 0,
        expires_at = v_now + make_interval(hours => v_need.cycle_duration_hours),
        updated_at = v_now
    WHERE id = v_need.id
    RETURNING * INTO v_need;
  END IF;

  RETURN v_need;
END;
$$;

GRANT EXECUTE ON FUNCTION close_need_cycle(UUID, INT, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 8. Ajustar categoria de notificaciones
-- ============================================================
CREATE OR REPLACE FUNCTION notification_category_for_type(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('user_signup', 'system_error', 'admin_created', 'center_registered') THEN 'system'
    WHEN p_type LIKE 'coordinator_%' OR p_type = 'coordinator_request' THEN 'requests'
    WHEN p_type LIKE 'report_%' OR p_type = 'citizen_report' THEN 'reports'
    WHEN p_type = 'guide_feedback' OR p_type LIKE 'faro_%' THEN 'messages'
    WHEN p_type IN ('need_critical', 'need_covered', 'delivery_registered', 'need_cycle_expired') THEN 'emergencies'
    WHEN p_type = 'verified_news' THEN 'verified_news'
    WHEN p_type = 'nearby_center' THEN 'nearby_centers'
    ELSE 'system'
  END;
$$;
