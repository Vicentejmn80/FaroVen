-- FARO — High Severity Remediation A-11
-- Ensure coordinator ownership when writing needs (defense in depth).

CREATE OR REPLACE FUNCTION validate_need_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM enforce_rate_limit('need_create', 120, 3600);
  ELSE
    PERFORM enforce_rate_limit('need_update', 600, 3600);
  END IF;

  PERFORM assert_text_bounds(NEW.item_name, 'item_name', 2, 255, true);
  PERFORM assert_text_bounds(NEW.unit, 'unit', 1, 50, true);
  PERFORM assert_text_bounds(NEW.notes, 'notes', 0, 1200, false);

  IF NEW.needable_type NOT IN ('hospital', 'shelter', 'supply_center') THEN
    RAISE EXCEPTION 'invalid_needable_type';
  END IF;

  IF NEW.qty_required < 0 OR NEW.qty_required > 1000000 THEN
    RAISE EXCEPTION 'invalid_qty_required';
  END IF;
  IF NEW.qty_received < 0 OR NEW.qty_received > 1000000 THEN
    RAISE EXCEPTION 'invalid_qty_received';
  END IF;

  -- A-11: verify coordinator ownership for authenticated non-admins
  IF auth.uid() IS NOT NULL AND NOT is_elevated_admin() THEN
    IF NOT EXISTS (
      SELECT 1
      FROM coordinator_profiles cp
      WHERE cp.auth_user_id = auth.uid()
        AND cp.site_type = NEW.needable_type
        AND cp.site_id = NEW.needable_id
        AND cp.onboarding_complete = true
    ) THEN
      RAISE EXCEPTION 'invalid_need_owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
