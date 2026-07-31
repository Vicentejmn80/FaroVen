-- FARO: reservas de inventario multi-voluntario, TTL 20m, RPCs atómicas

-- 1) Permitir N reservas por misión (cobertura parcial)
ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_mission_id_key;

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_mission_id_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_reservations_mission_id_key'
  ) THEN
    ALTER TABLE public.inventory_reservations DROP CONSTRAINT inventory_reservations_mission_id_key;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_mission_status
  ON public.inventory_reservations (mission_id, status);

-- 2) Columnas TTL / aceptación / voluntario
ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS volunteer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires
  ON public.inventory_reservations (expires_at)
  WHERE status = 'reserved' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_volunteer_user
  ON public.inventory_reservations (volunteer_user_id)
  WHERE volunteer_user_id IS NOT NULL;

-- Voluntarios pueden ver sus propias reservas
DROP POLICY IF EXISTS inventory_reservations_select_volunteer ON public.inventory_reservations;
CREATE POLICY inventory_reservations_select_volunteer ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (volunteer_user_id = auth.uid());

-- 3) Reserva atómica de inventario (voluntario → centro)
CREATE OR REPLACE FUNCTION public.reserve_inventory_for_mission(
  p_mission_id uuid,
  p_case_id uuid,
  p_center_id text,
  p_resource_type text,
  p_quantity int,
  p_volunteer_id text DEFAULT NULL,
  p_ttl_minutes int DEFAULT 20
)
RETURNS public.inventory_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.center_resources;
  v_available int;
  v_res public.inventory_reservations;
  v_user uuid := auth.uid();
  v_ttl int := GREATEST(COALESCE(p_ttl_minutes, 20), 1);
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero';
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación';
  END IF;

  SELECT * INTO v_row
  FROM public.center_resources
  WHERE center_id = p_center_id
    AND resource_type = p_resource_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El centro no tiene ese recurso en inventario';
  END IF;

  v_available := GREATEST(COALESCE(v_row.current_level, 0) - COALESCE(v_row.reserved_level, 0), 0);
  IF p_quantity > v_available THEN
    RAISE EXCEPTION 'Cantidad excede el inventario disponible (% restantes)', v_available;
  END IF;

  INSERT INTO public.inventory_reservations (
    mission_id,
    case_id,
    center_id,
    resource_type,
    quantity,
    status,
    volunteer_id,
    volunteer_user_id,
    expires_at
  )
  VALUES (
    p_mission_id,
    p_case_id,
    p_center_id,
    p_resource_type,
    p_quantity,
    'reserved',
    p_volunteer_id,
    v_user,
    now() + make_interval(mins => v_ttl)
  )
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_inventory_for_mission(uuid, uuid, text, text, int, text, int)
  TO authenticated;

-- 4) Centro acepta reserva voluntario → ready + accepted_at
CREATE OR REPLACE FUNCTION public.accept_inventory_reservation(p_reservation_id uuid)
RETURNS public.inventory_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.inventory_reservations;
BEGIN
  SELECT * INTO v_res
  FROM public.inventory_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  IF v_res.status <> 'reserved' THEN
    RAISE EXCEPTION 'Solo se pueden aceptar reservas en estado reserved';
  END IF;

  IF v_res.expires_at IS NOT NULL AND v_res.expires_at < now() THEN
    UPDATE public.inventory_reservations
    SET status = 'released', updated_at = now()
    WHERE id = p_reservation_id
    RETURNING * INTO v_res;
    RAISE EXCEPTION 'La reserva expiró y fue liberada';
  END IF;

  IF NOT (
    public.is_center_coordinator(v_res.center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado para aceptar esta reserva';
  END IF;

  UPDATE public.inventory_reservations
  SET
    status = 'ready',
    accepted_at = now(),
    responded_at = COALESCE(responded_at, now()),
    updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_inventory_reservation(uuid) TO authenticated;

-- 5) Liberar reservas vencidas
CREATE OR REPLACE FUNCTION public.expire_stale_inventory_reservations()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH expired AS (
    UPDATE public.inventory_reservations
    SET status = 'released', updated_at = now()
    WHERE status = 'reserved'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM expired;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_inventory_reservations() TO authenticated;

-- Capacidad atómica garantizada por reserve_inventory_for_mission (FOR UPDATE).
