-- Permite al gestor de casos eliminar un caso y todas sus dependencias operativas.

CREATE OR REPLACE FUNCTION public.delete_operational_case(p_case_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission_ids UUID[];
  v_need_ids UUID[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cases WHERE id = p_case_id) THEN
    RAISE EXCEPTION 'case_not_found';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_mission_ids
  FROM missions
  WHERE case_id = p_case_id;

  SELECT coalesce(array_agg(id), '{}') INTO v_need_ids
  FROM public_needs
  WHERE case_id = p_case_id;

  IF array_length(v_need_ids, 1) IS NOT NULL THEN
    DELETE FROM success_cases WHERE public_need_id = ANY (v_need_ids);
    DELETE FROM coverage_reservations WHERE public_need_id = ANY (v_need_ids);

    IF to_regclass('public.need_verifications') IS NOT NULL THEN
      EXECUTE 'DELETE FROM need_verifications WHERE public_need_id = ANY ($1)'
      USING v_need_ids;
    END IF;

    IF to_regclass('public.need_timelines') IS NOT NULL THEN
      EXECUTE 'DELETE FROM need_timelines WHERE public_need_id = ANY ($1)'
      USING v_need_ids;
    END IF;

    DELETE FROM public_needs WHERE id = ANY (v_need_ids);
  END IF;

  DELETE FROM success_cases WHERE case_id = p_case_id;

  IF array_length(v_mission_ids, 1) IS NOT NULL THEN
    DELETE FROM inventory_reservations WHERE mission_id = ANY (v_mission_ids);
    DELETE FROM mission_events WHERE mission_id = ANY (v_mission_ids);
    DELETE FROM mission_assignments WHERE mission_id = ANY (v_mission_ids);
    DELETE FROM missions WHERE id = ANY (v_mission_ids);
  END IF;

  DELETE FROM inventory_reservations WHERE case_id = p_case_id;

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

GRANT EXECUTE ON FUNCTION public.delete_operational_case(UUID) TO authenticated;
