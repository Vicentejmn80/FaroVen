-- Fix pipeline stage used by volunteer map + full super_admin delete powers

-- ============================================================
-- 1. Missing enum values (root cause of cases 400)
-- ============================================================
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'open_for_applications';
ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'case_opened_for_applications';

-- ============================================================
-- 2. RLS: super_admin can delete operational entities
-- ============================================================
DROP POLICY IF EXISTS needs_super_admin_delete ON needs;
CREATE POLICY needs_super_admin_delete
  ON needs FOR DELETE TO authenticated
  USING (is_super_admin() OR is_admin());

DROP POLICY IF EXISTS public_needs_super_admin_all ON public_needs;
CREATE POLICY public_needs_super_admin_all
  ON public_needs FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS cases_super_admin_all ON cases;
CREATE POLICY cases_super_admin_all
  ON cases FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT DELETE ON needs, public_needs, cases TO authenticated;

-- ============================================================
-- 3. admin_delete_need — center-linked needs
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_need(p_need_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM needs WHERE id = p_need_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_need(UUID) TO authenticated;

-- ============================================================
-- 4. admin_delete_public_need — citizen/public radar needs
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_public_need(p_public_need_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- success_cases has ON DELETE RESTRICT
  DELETE FROM success_cases WHERE public_need_id = p_public_need_id;

  DELETE FROM public_needs WHERE id = p_public_need_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_public_need(UUID) TO authenticated;

-- ============================================================
-- 5. admin_delete_case — cases + related applications/events
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_case(p_case_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public_needs SET case_id = NULL WHERE case_id = p_case_id;

  IF to_regclass('public.case_applications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM case_applications WHERE case_id = $1' USING p_case_id;
  END IF;
  IF to_regclass('public.case_assignments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM case_assignments WHERE case_id = $1' USING p_case_id;
  END IF;
  IF to_regclass('public.case_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM case_events WHERE case_id = $1' USING p_case_id;
  END IF;

  DELETE FROM cases WHERE id = p_case_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_case(UUID) TO authenticated;
