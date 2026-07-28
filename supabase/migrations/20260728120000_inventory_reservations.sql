-- FARO: Red logistica inteligente — reservas de inventario por mision
-- reserved_level se mantiene por triggers; available = current_level - reserved_level.

ALTER TABLE public.center_resources
  ADD COLUMN IF NOT EXISTS reserved_level INT NOT NULL DEFAULT 0;

ALTER TABLE public.center_resources
  DROP CONSTRAINT IF EXISTS center_resources_reserved_non_negative;
ALTER TABLE public.center_resources
  ADD CONSTRAINT center_resources_reserved_non_negative CHECK (reserved_level >= 0);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL UNIQUE REFERENCES public.missions(id) ON DELETE CASCADE,
  case_id       UUID NOT NULL,
  center_id     TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  status        TEXT NOT NULL DEFAULT 'reserved'
                CHECK (status IN ('reserved', 'ready', 'delivered', 'released', 'cancelled')),
  volunteer_id  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_center
  ON public.inventory_reservations (center_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_case
  ON public.inventory_reservations (case_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_mission
  ON public.inventory_reservations (mission_id);

-- Actualiza reserved_level segun estado (reserved/ready cuentan como reservado).
CREATE OR REPLACE FUNCTION public.sync_center_reserved_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('reserved', 'ready') THEN
      UPDATE public.center_resources
      SET reserved_level = reserved_level + NEW.quantity,
          updated_at = now()
      WHERE center_id = NEW.center_id AND resource_type = NEW.resource_type;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('reserved', 'ready') AND NEW.status NOT IN ('reserved', 'ready') THEN
      UPDATE public.center_resources
      SET reserved_level = GREATEST(reserved_level - OLD.quantity, 0),
          updated_at = now()
      WHERE center_id = OLD.center_id AND resource_type = OLD.resource_type;
    ELSIF OLD.status NOT IN ('reserved', 'ready') AND NEW.status IN ('reserved', 'ready') THEN
      UPDATE public.center_resources
      SET reserved_level = reserved_level + NEW.quantity,
          updated_at = now()
      WHERE center_id = NEW.center_id AND resource_type = NEW.resource_type;
    ELSIF OLD.status IN ('reserved', 'ready') AND NEW.status IN ('reserved', 'ready') AND OLD.quantity <> NEW.quantity THEN
      UPDATE public.center_resources
      SET reserved_level = GREATEST(reserved_level + (NEW.quantity - OLD.quantity), 0),
          updated_at = now()
      WHERE center_id = NEW.center_id AND resource_type = NEW.resource_type;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('reserved', 'ready') THEN
      UPDATE public.center_resources
      SET reserved_level = GREATEST(reserved_level - OLD.quantity, 0),
          updated_at = now()
      WHERE center_id = OLD.center_id AND resource_type = OLD.resource_type;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_center_reserved_level ON public.inventory_reservations;
CREATE TRIGGER trg_sync_center_reserved_level
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_center_reserved_level();

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_reservations_select ON public.inventory_reservations;
DROP POLICY IF EXISTS inventory_reservations_insert ON public.inventory_reservations;
DROP POLICY IF EXISTS inventory_reservations_update ON public.inventory_reservations;
DROP POLICY IF EXISTS inventory_reservations_delete ON public.inventory_reservations;

CREATE POLICY inventory_reservations_select ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (
    public.is_center_coordinator(center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY inventory_reservations_insert ON public.inventory_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY inventory_reservations_update ON public.inventory_reservations
  FOR UPDATE TO authenticated
  USING (
    public.is_center_coordinator(center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  )
  WITH CHECK (
    public.is_center_coordinator(center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY inventory_reservations_delete ON public.inventory_reservations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
