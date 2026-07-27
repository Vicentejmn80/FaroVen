-- FARO: Nodo Logistico — inventario de centro + movimientos + RLS
-- Crea center_resources / center_events si no existen (ops V1 no estaba en prod).

CREATE TABLE IF NOT EXISTS public.center_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  current_level INT NOT NULL DEFAULT 0,
  max_level     INT NOT NULL DEFAULT 0,
  min_level     INT NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'unidades',
  category      TEXT NOT NULL DEFAULT 'alimentos',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.center_resources
  ADD COLUMN IF NOT EXISTS min_level INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'alimentos';

ALTER TABLE public.center_resources DROP CONSTRAINT IF EXISTS center_resources_resource_type_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'center_resources' AND column_name = 'resource_type'
  ) THEN
    DELETE FROM public.center_resources w
    USING public.center_resources a
    WHERE w.resource_type = 'water'
      AND a.resource_type = 'agua'
      AND w.center_id = a.center_id;

    UPDATE public.center_resources
    SET resource_type = 'agua', category = 'alimentos'
    WHERE resource_type = 'water';

    DELETE FROM public.center_resources m
    USING public.center_resources g
    WHERE m.resource_type = 'medicine'
      AND g.resource_type = 'medicamentos'
      AND m.center_id = g.center_id;

    UPDATE public.center_resources
    SET resource_type = 'medicamentos', category = 'medicamentos'
    WHERE resource_type = 'medicine';

    DELETE FROM public.center_resources f
    USING public.center_resources g
    WHERE f.resource_type = 'food'
      AND g.resource_type = 'alimentos'
      AND f.center_id = g.center_id;

    UPDATE public.center_resources
    SET resource_type = 'alimentos', category = 'alimentos'
    WHERE resource_type = 'food';

    UPDATE public.center_resources SET category = 'logistica' WHERE resource_type = 'beds';
    UPDATE public.center_resources SET category = 'apoyo' WHERE resource_type = 'personnel';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_center_resources_center_type
  ON public.center_resources (center_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_center_resources_center ON public.center_resources (center_id);

CREATE TABLE IF NOT EXISTS public.center_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  previous_value TEXT,
  new_value      TEXT,
  actor_id       TEXT,
  actor_name     TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_center_events_center ON public.center_events (center_id);
CREATE INDEX IF NOT EXISTS idx_center_events_created ON public.center_events (center_id, created_at DESC);

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
    'operational_mode_changed'::text
  ]));

CREATE TABLE IF NOT EXISTS public.center_inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  delta         INT NOT NULL,
  balance_after INT NOT NULL DEFAULT 0,
  reason        TEXT NOT NULL DEFAULT 'adjustment'
                CHECK (reason IN ('donation', 'dispatch', 'mission', 'adjustment', 'intake', 'outflow')),
  source_label  TEXT,
  mission_id    TEXT,
  actor_id      TEXT,
  actor_name    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_center
  ON public.center_inventory_movements (center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_resource
  ON public.center_inventory_movements (center_id, resource_type);

ALTER TABLE public.center_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_center_coordinator(p_center_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coordinator_profiles cp
    WHERE cp.auth_user_id = auth.uid()
      AND cp.site_id::text = p_center_id
      AND COALESCE(cp.onboarding_complete, true) = true
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('regional_admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_center_coordinator(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_center_coordinator(text) TO authenticated;

DROP POLICY IF EXISTS center_resources_select ON public.center_resources;
DROP POLICY IF EXISTS center_resources_insert ON public.center_resources;
DROP POLICY IF EXISTS center_resources_update ON public.center_resources;
DROP POLICY IF EXISTS center_resources_delete ON public.center_resources;

CREATE POLICY center_resources_select ON public.center_resources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY center_resources_insert ON public.center_resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_center_coordinator(center_id));

CREATE POLICY center_resources_update ON public.center_resources
  FOR UPDATE TO authenticated
  USING (public.is_center_coordinator(center_id))
  WITH CHECK (public.is_center_coordinator(center_id));

CREATE POLICY center_resources_delete ON public.center_resources
  FOR DELETE TO authenticated
  USING (public.is_center_coordinator(center_id));

DROP POLICY IF EXISTS center_events_select ON public.center_events;
DROP POLICY IF EXISTS center_events_insert ON public.center_events;

CREATE POLICY center_events_select ON public.center_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('coordinator', 'case_manager', 'regional_admin', 'super_admin')
  ));

CREATE POLICY center_events_insert ON public.center_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_center_coordinator(center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS inv_movements_select ON public.center_inventory_movements;
DROP POLICY IF EXISTS inv_movements_insert ON public.center_inventory_movements;

CREATE POLICY inv_movements_select ON public.center_inventory_movements
  FOR SELECT TO authenticated
  USING (
    public.is_center_coordinator(center_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'regional_admin', 'super_admin')
    )
  );

CREATE POLICY inv_movements_insert ON public.center_inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_center_coordinator(center_id));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.center_resources;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.center_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.center_inventory_movements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
