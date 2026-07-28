-- FARO: Red logistica inteligente — campos de recurso/recogida en missions

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS pickup_center_id TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_qty INT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

CREATE INDEX IF NOT EXISTS idx_missions_pickup_center
  ON public.missions (pickup_center_id);
