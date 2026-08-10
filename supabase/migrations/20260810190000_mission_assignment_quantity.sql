-- Cantidad ofrecida/entregada por voluntario en cada asignación de misión (cobertura acumulativa).

ALTER TABLE public.mission_assignments
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.mission_assignments
  DROP CONSTRAINT IF EXISTS mission_assignments_quantity_check;

ALTER TABLE public.mission_assignments
  ADD CONSTRAINT mission_assignments_quantity_check
  CHECK (quantity >= 1);
