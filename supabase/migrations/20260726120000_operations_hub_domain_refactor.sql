-- Operations Hub domain refactor:
-- report -> case -> need -> call -> application -> mission.
--
-- NOTE: report_status enum values 'reviewing' / 'converted' must be added in a
-- prior migration (or a separate transaction) before indexes that reference them.
-- Production applied as:
--   1) report_status_converted_reviewing
--   2) operations_hub_call_status_and_volunteer_rls

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_status_check;

CREATE INDEX IF NOT EXISTS idx_reports_converted_created
  ON public.reports (created_at DESC)
  WHERE status = 'converted';

CREATE INDEX IF NOT EXISTS idx_reports_pending_inbox
  ON public.reports (created_at DESC)
  WHERE status IN ('pending', 'under_review', 'reviewing');

ALTER TABLE public.public_needs
  ADD COLUMN IF NOT EXISTS call_status TEXT NOT NULL DEFAULT 'closed';

ALTER TABLE public.public_needs
  DROP CONSTRAINT IF EXISTS public_needs_call_status_check;

ALTER TABLE public.public_needs
  ADD CONSTRAINT public_needs_call_status_check
  CHECK (call_status IN ('open', 'closed', 'complete'));

COMMENT ON COLUMN public.public_needs.call_status IS
  'Convocatoria: open = voluntarios pueden postularse; closed = oculta; complete = cupo lleno';

CREATE INDEX IF NOT EXISTS idx_public_needs_call_status
  ON public.public_needs (call_status, status, created_at DESC);

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

DROP POLICY IF EXISTS coverage_reservations_insert_public ON public.coverage_reservations;
CREATE POLICY coverage_reservations_insert_public ON public.coverage_reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.public_needs n
    WHERE n.id = public_need_id
      AND n.visibility_status = 'public'
      AND n.call_status = 'open'
      AND n.status IN ('active', 'reserved', 'in_progress')
      AND n.remaining_quantity > 0
      AND n.expires_at > now()
  )
);

CREATE OR REPLACE FUNCTION public.sync_public_need_coverage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_need uuid;
  confirmed_qty numeric(12,2);
BEGIN
  target_need := coalesce(new.public_need_id, old.public_need_id);

  SELECT coalesce(sum(quantity), 0)
    INTO confirmed_qty
  FROM public.coverage_reservations
  WHERE public_need_id = target_need
    AND status = 'confirmed';

  UPDATE public.public_needs
  SET
    covered_quantity = confirmed_qty,
    call_status = CASE
      WHEN status IN ('closed', 'archived') THEN call_status
      WHEN confirmed_qty >= required_quantity THEN 'complete'
      ELSE call_status
    END,
    visibility_status = CASE
      WHEN confirmed_qty >= required_quantity THEN 'hidden'
      ELSE visibility_status
    END,
    status = CASE
      WHEN status IN ('closed', 'archived') THEN status
      WHEN expires_at < now() THEN 'expired'
      WHEN confirmed_qty >= required_quantity THEN 'completed'
      WHEN confirmed_qty > 0 THEN 'in_progress'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE id = target_need;

  RETURN coalesce(new, old);
END;
$$;

DROP POLICY IF EXISTS cases_select_volunteers_open ON public.cases;
CREATE POLICY cases_select_volunteers_open ON public.cases
FOR SELECT
TO authenticated
USING (
  pipeline_stage = 'open_for_applications'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'volunteer'
      AND status = 'active'
  )
);

INSERT INTO volunteers (user_id, full_name, availability)
SELECT p.id, COALESCE(NULLIF(p.full_name, ''), 'Voluntario'), 'available'
FROM profiles p
WHERE p.role = 'volunteer'
  AND p.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM volunteers v WHERE v.user_id = p.id);
