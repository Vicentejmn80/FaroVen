-- FARO — Timeline de alto valor
-- Elimina ruido de inventario y emite solo hitos operativos.

-- ============================================================
-- 1. Necesidades: solo creación e inventario completado
-- ============================================================
CREATE OR REPLACE FUNCTION log_event_from_need()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_incomplete BOOLEAN;
  v_now_complete BOOLEAN;
BEGIN
  -- Permite que close_need_cycle emita sus propios hitos sin duplicar.
  IF current_setting('faro.skip_need_event', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO events (kind, title, detail, status, center_type, center_id)
    VALUES (
      'need_created',
      'Nueva necesidad creada',
      NEW.item_name,
      CASE
        WHEN NEW.priority = 'critical' THEN 'critical'
        WHEN NEW.priority = 'high' THEN 'warning'
        ELSE 'info'
      END,
      NEW.needable_type,
      NEW.needable_id
    );
    RETURN NEW;
  END IF;

  -- Solo hito cuando la cobertura cruza a 100% (inventario completado).
  v_was_incomplete := OLD.qty_required > 0 AND OLD.qty_received < OLD.qty_required;
  v_now_complete := NEW.qty_required > 0 AND NEW.qty_received >= NEW.qty_required;

  IF v_was_incomplete AND v_now_complete THEN
    INSERT INTO events (kind, title, detail, status, center_type, center_id)
    VALUES (
      'inventory_complete',
      'Inventario completado',
      NEW.item_name,
      'operational',
      NEW.needable_type,
      NEW.needable_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Centros: solo cambio de estado relevante
-- ============================================================
CREATE OR REPLACE FUNCTION log_event_from_center()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  center_kind TEXT;
BEGIN
  center_kind := TG_ARGV[0];

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'saturation',
    NEW.name || ' cambió de estado',
    'Estado: ' || COALESCE(NEW.status::TEXT, 'actualizado'),
    CASE
      WHEN NEW.status::TEXT IN ('critical', 'inactive') THEN 'warning'
      WHEN NEW.status::TEXT IN ('active', 'operational') THEN 'operational'
      ELSE 'info'
    END,
    center_kind,
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Saturación de sitio: solo si cambia el nivel
-- ============================================================
CREATE OR REPLACE FUNCTION log_event_from_site_saturation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.level IS NOT DISTINCT FROM NEW.level THEN
    RETURN NEW;
  END IF;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'saturation',
    'Nivel de saturación actualizado',
    NEW.need_label || ' → ' || NEW.level::TEXT,
    CASE
      WHEN NEW.level::TEXT = 'critical' THEN 'critical'
      WHEN NEW.level::TEXT = 'high' THEN 'warning'
      ELSE 'info'
    END,
    NEW.site_type,
    NEW.site_id
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Reportes: solo recepción (INSERT) y decisión (status)
-- ============================================================
CREATE OR REPLACE FUNCTION log_event_from_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO events (kind, title, detail, status, center_type, center_id, report_id)
    VALUES (
      'report',
      'Reporte ciudadano recibido',
      left(coalesce(NEW.description, 'Nuevo reporte ciudadano'), 180),
      'warning',
      NEW.site_type,
      NEW.site_id,
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status::TEXT NOT IN ('verified', 'dismissed') THEN
      RETURN NEW;
    END IF;

    INSERT INTO events (kind, title, detail, status, center_type, center_id, report_id)
    VALUES (
      'report',
      CASE
        WHEN NEW.status::TEXT = 'verified' THEN 'Reporte aprobado'
        ELSE 'Reporte rechazado'
      END,
      left(coalesce(NEW.review_notes, NEW.description, ''), 180),
      CASE
        WHEN NEW.status::TEXT = 'verified' THEN 'operational'
        ELSE 'info'
      END,
      NEW.site_type,
      NEW.site_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Cierre de ciclo: emitir hitos explícitos
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
  v_event_kind TEXT;
  v_event_title TEXT;
  v_event_detail TEXT;
  v_event_status TEXT;
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

  -- Evitar que el trigger de needs duplique el hito.
  PERFORM set_config('faro.skip_need_event', '1', true);

  IF v_next_status = 'resolved' THEN
    UPDATE needs
    SET status = 'resolved',
        qty_received = v_total_received,
        closed_at = v_now,
        closure_reason = p_closure_reason,
        updated_at = v_now
    WHERE id = v_need.id
    RETURNING * INTO v_need;

    IF v_outcome = 'resolved' AND v_remaining = 0 AND v_need.qty_required > 0 THEN
      v_event_kind := 'need_resolved';
      v_event_title := 'Necesidad resuelta';
      v_event_detail := v_need.item_name || ' · ciclo ' || (v_need.cycle_number)::TEXT;
      v_event_status := 'operational';
    ELSE
      v_event_kind := 'cycle_closed';
      v_event_title := 'Ciclo operativo cerrado';
      v_event_detail := v_need.item_name || ' · ciclo ' || (v_need.cycle_number)::TEXT;
      v_event_status := 'info';
    END IF;
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

    v_event_kind := 'need_reopened';
    v_event_title := 'Necesidad reabierta';
    v_event_detail := v_need.item_name || ' · ciclo ' || (v_need.cycle_number)::TEXT;
    v_event_status := 'warning';
  END IF;

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    v_event_kind,
    v_event_title,
    v_event_detail,
    v_event_status,
    v_need.needable_type,
    v_need.needable_id
  );

  RETURN v_need;
END;
$$;

GRANT EXECUTE ON FUNCTION close_need_cycle(UUID, INT, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 6. Coordinador aprobado => hito en timeline
-- ============================================================
CREATE OR REPLACE FUNCTION approve_coordinator_request(
  p_request_id UUID,
  p_assigned_site_type TEXT,
  p_assigned_site_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS coordinator_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request coordinator_requests%ROWTYPE;
  v_user_id UUID;
  v_center_name TEXT;
BEGIN
  IF NOT is_elevated_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_request
  FROM coordinator_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  v_user_id := coordinator_request_user_id(v_request);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found_for_request';
  END IF;

  PERFORM assert_valid_site_reference(p_assigned_site_type, p_assigned_site_id);

  UPDATE coordinator_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      assigned_site_type = p_assigned_site_type,
      assigned_site_id = p_assigned_site_id,
      review_notes = p_review_notes,
      needs_info_response = false,
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (v_user_id, v_request.email, v_request.full_name, 'coordinator', 'active')
  ON CONFLICT (id) DO UPDATE
    SET role = CASE
        WHEN profiles.role IN ('regional_admin', 'super_admin') THEN profiles.role
        ELSE 'coordinator'
      END,
        full_name = EXCLUDED.full_name,
        status = 'active',
        updated_at = now();

  INSERT INTO coordinator_profiles (
    auth_user_id,
    site_type,
    site_id,
    full_name,
    phone,
    role_title,
    organization,
    onboarding_complete,
    updated_at
  )
  VALUES (
    v_user_id,
    p_assigned_site_type,
    p_assigned_site_id,
    v_request.full_name,
    v_request.phone,
    v_request.role_title,
    v_request.organization,
    true,
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET site_type = EXCLUDED.site_type,
        site_id = EXCLUDED.site_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role_title = EXCLUDED.role_title,
        organization = EXCLUDED.organization,
        onboarding_complete = true,
        updated_at = now();

  PERFORM log_auth_event(
    'coordinator_request_approved',
    v_user_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id
    )
  );

  v_center_name := coordinator_request_center_name(p_assigned_site_type, p_assigned_site_id);

  PERFORM notify_coordinator_request_user(
    v_user_id,
    'coordinator_request_approved',
    'Solicitud aprobada',
    'Ahora eres coordinador de ' || v_center_name || '.',
    jsonb_build_object(
      'center_name', v_center_name,
      'site_type', p_assigned_site_type,
      'site_id', p_assigned_site_id,
      'request_id', v_request.id
    ),
    v_request.id
  );

  INSERT INTO events (kind, title, detail, status, center_type, center_id)
  VALUES (
    'coordinator_approved',
    'Coordinador aprobado',
    v_request.full_name || ' · ' || v_center_name,
    'operational',
    p_assigned_site_type,
    p_assigned_site_id
  );

  RETURN v_request;
END;
$$;

-- ============================================================
-- 7. Limpieza de ruido histórico
-- ============================================================
DELETE FROM events
WHERE kind = 'inventory'
  AND title IN (
    'Actualización de inventario',
    'Llegada de donación registrada',
    'Salida de inventario registrada'
  );

DELETE FROM events
WHERE kind = 'saturation'
  AND (
    title LIKE '% actualizado'
    OR title = 'Saturación actualizada'
  );

-- Normalizar títulos antiguos de necesidades sin porcentaje.
UPDATE events
SET
  kind = 'need_created',
  detail = regexp_replace(detail, '\s*\([0-9]+(\.[0-9]+)?% cubierto\)\s*$', '')
WHERE kind = 'inventory'
  AND title = 'Nueva necesidad registrada';

UPDATE events
SET
  kind = 'inventory_complete',
  title = 'Inventario completado',
  detail = regexp_replace(detail, '\s*\([0-9]+(\.[0-9]+)?% cubierto\)\s*$', '')
WHERE kind = 'inventory'
  AND title = 'Necesidad cubierta';

UPDATE events
SET detail = regexp_replace(detail, '\s*\([0-9]+(\.[0-9]+)?% cubierto\)\s*$', '')
WHERE detail ~ '% cubierto\)';
