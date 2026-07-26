-- Fix: case_manager could create the case but PATCH reports → converted
-- returned 406 because no UPDATE policy allowed status='converted'.
-- Result: case in Casos, report still pending in Bandeja, retries → duplicates.

-- ============================================================
-- 1. Operators can update citizen reports through the ops pipeline
-- ============================================================
DROP POLICY IF EXISTS reports_ops_update ON public.reports;
CREATE POLICY reports_ops_update
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  )
  WITH CHECK (
    status IN (
      'pending', 'under_review', 'reviewing', 'verified',
      'dismissed', 'converted'
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
    )
  );

-- Coordinator site policy WITH CHECK previously blocked 'converted'
DROP POLICY IF EXISTS coordinator_review_own_site_reports ON public.reports;
CREATE POLICY coordinator_review_own_site_reports
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    status IN ('pending', 'under_review', 'reviewing')
    AND EXISTS (
      SELECT 1 FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_id = reports.site_id
        AND cp.site_type = reports.site_type
        AND cp.onboarding_complete IS NOT FALSE
    )
  )
  WITH CHECK (
    status IN (
      'verified', 'dismissed', 'under_review', 'pending',
      'reviewing', 'converted'
    )
  );

-- ============================================================
-- 2. SECURITY DEFINER RPC — reliable mark-converted path
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_report_converted(
  p_report_id UUID,
  p_case_id UUID
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.reports%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE reports
  SET
    status = 'converted',
    review_notes = coalesce(review_notes, '') ||
      CASE WHEN coalesce(review_notes, '') = '' THEN '' ELSE E'\n' END ||
      'Convertido en caso operativo ' || p_case_id::text,
    reviewed_at = now()
  WHERE id = p_report_id
    AND status IN ('pending', 'under_review', 'reviewing')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Already converted or missing: return current row if exists
    SELECT * INTO v_row FROM reports WHERE id = p_report_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'report_not_found';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_report_converted(UUID, UUID) TO authenticated;
