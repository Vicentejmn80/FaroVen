-- FARO: pipeline único Solicitud → GC → Misión
-- Extiende cases con clasificación; quita INSERT de coordinator en missions.

-- ============================================================
-- 1) Clasificación de solicitudes en cases
-- ============================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'manual_request',
  ADD COLUMN IF NOT EXISTS operation_type TEXT NOT NULL DEFAULT 'incident';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_request_source_check'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_request_source_check
      CHECK (request_source IN ('citizen', 'coordinator', 'manual', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_request_type_check'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_request_type_check
      CHECK (request_type IN ('report', 'inventory_request', 'manual_request'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_operation_type_check'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_operation_type_check
      CHECK (operation_type IN ('incident', 'resource_request', 'transfer', 'volunteer_mission'));
  END IF;
END $$;

-- Backfill: casos ligados a reporte ciudadano
UPDATE public.cases
SET
  request_source = 'citizen',
  request_type = 'report',
  operation_type = 'incident'
WHERE
  metadata ? 'report_id'
  AND request_source = 'manual'
  AND request_type = 'manual_request';

COMMENT ON COLUMN public.cases.request_source IS 'Origen: citizen | coordinator | manual | admin';
COMMENT ON COLUMN public.cases.request_type IS 'Tipo solicitud: report | inventory_request | manual_request';
COMMENT ON COLUMN public.cases.operation_type IS 'Flujo: incident | resource_request | transfer | volunteer_mission';

-- ============================================================
-- 2) Solo GC/admins crean misiones (coordinador no INSERT)
-- ============================================================

DROP POLICY IF EXISTS missions_insert ON public.missions;
CREATE POLICY missions_insert ON public.missions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'regional_admin', 'super_admin')
  ));

DROP POLICY IF EXISTS mission_assignments_insert ON public.mission_assignments;
CREATE POLICY mission_assignments_insert ON public.mission_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'regional_admin', 'super_admin')
  ));
