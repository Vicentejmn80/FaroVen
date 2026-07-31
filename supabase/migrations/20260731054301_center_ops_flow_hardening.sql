-- FARO ops hardening: columnas faltantes + respuesta operativa del centro + RLS radar

-- 1) operational_mode (migración antigua no aplicada en prod)
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active';
ALTER TABLE shelters
  ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active';
ALTER TABLE supply_centers
  ADD COLUMN IF NOT EXISTS operational_mode TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitals_operational_mode_check') THEN
    ALTER TABLE hospitals ADD CONSTRAINT hospitals_operational_mode_check
      CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelters_operational_mode_check') THEN
    ALTER TABLE shelters ADD CONSTRAINT shelters_operational_mode_check
      CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supply_centers_operational_mode_check') THEN
    ALTER TABLE supply_centers ADD CONSTRAINT supply_centers_operational_mode_check
      CHECK (operational_mode IN ('active', 'limited', 'saturated', 'inactive', 'emergency_only'));
  END IF;
END $$;

-- 2) Respuesta operativa del coordinador sobre solicitudes de inventario
ALTER TABLE public.inventory_reservations
  ADD COLUMN IF NOT EXISTS resolution_mode TEXT,
  ADD COLUMN IF NOT EXISTS resolution_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coordinator_notes TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reservations_resolution_mode_check'
  ) THEN
    ALTER TABLE public.inventory_reservations
      ADD CONSTRAINT inventory_reservations_resolution_mode_check
      CHECK (
        resolution_mode IS NULL
        OR resolution_mode IN ('brigade', 'delivery', 'needs_volunteer')
      );
  END IF;
END $$;

-- 3) Asegurar políticas RLS del radar (voluntarios ven convocatorias abiertas)
DROP POLICY IF EXISTS public_needs_select_public ON public.public_needs;
CREATE POLICY public_needs_select_public ON public.public_needs
FOR SELECT
TO anon, authenticated
USING (
  visibility_status = 'public'
  AND call_status = 'open'
  AND status IN ('active', 'reserved', 'in_progress')
  AND expires_at > (now() - interval '24 hours')
);

DROP POLICY IF EXISTS public_needs_select_operators ON public.public_needs;
CREATE POLICY public_needs_select_operators ON public.public_needs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS public_needs_update_operators ON public.public_needs;
CREATE POLICY public_needs_update_operators ON public.public_needs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'regional_admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'regional_admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS public_needs_insert_operators ON public.public_needs;
CREATE POLICY public_needs_insert_operators ON public.public_needs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'regional_admin', 'super_admin')
  )
);
