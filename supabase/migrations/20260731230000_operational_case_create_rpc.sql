-- Wizard Operativo: creación confiable de casos desde reporte (SECURITY DEFINER)
-- y RLS basada en is_network_operator() para evitar fallos de subquery en profiles.

-- ============================================================
-- 1) RLS cases / case_events — helper SECURITY DEFINER
-- ============================================================
DROP POLICY IF EXISTS cases_select_any ON public.cases;
CREATE POLICY cases_select_any ON public.cases
  FOR SELECT TO authenticated
  USING (public.is_network_operator());

DROP POLICY IF EXISTS cases_insert_any ON public.cases;
CREATE POLICY cases_insert_any ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (public.is_network_operator());

DROP POLICY IF EXISTS cases_update_any ON public.cases;
CREATE POLICY cases_update_any ON public.cases
  FOR UPDATE TO authenticated
  USING (public.is_network_operator())
  WITH CHECK (public.is_network_operator());

DROP POLICY IF EXISTS case_events_select ON public.case_events;
CREATE POLICY case_events_select ON public.case_events
  FOR SELECT TO authenticated
  USING (public.is_network_operator());

DROP POLICY IF EXISTS case_events_insert ON public.case_events;
CREATE POLICY case_events_insert ON public.case_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_network_operator());

-- ============================================================
-- 2) RPC — crear o enriquecer caso operativo desde reporte
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_operational_case_from_report(
  p_report_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_priority public.case_priority,
  p_zone TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_address TEXT,
  p_category TEXT,
  p_affected_count INTEGER,
  p_reporter_name TEXT DEFAULT NULL,
  p_reporter_phone TEXT DEFAULT NULL,
  p_reporter_email TEXT DEFAULT NULL,
  p_request_source TEXT DEFAULT 'citizen',
  p_request_type TEXT DEFAULT 'report',
  p_operation_type TEXT DEFAULT 'incident',
  p_wizard_metadata JSONB DEFAULT NULL
)
RETURNS public.cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_metadata JSONB;
  v_existing_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_network_operator() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT c.id
    INTO v_existing_id
  FROM public.cases c
  WHERE c.metadata->>'report_id' = p_report_id::text
    AND c.pipeline_stage NOT IN ('archived', 'resolved')
  ORDER BY c.created_at DESC
  LIMIT 1;

  v_metadata := jsonb_build_object('report_id', p_report_id::text);
  IF p_wizard_metadata IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('wizard', p_wizard_metadata);
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.cases
    SET
      title = p_title,
      description = COALESCE(p_description, ''),
      priority = p_priority,
      zone = COALESCE(NULLIF(p_zone, ''), zone, ''),
      latitude = p_latitude,
      longitude = p_longitude,
      address = COALESCE(p_address, address),
      category = p_category,
      affected_count = GREATEST(COALESCE(p_affected_count, 1), 1),
      reporter_name = COALESCE(p_reporter_name, reporter_name),
      reporter_phone = COALESCE(p_reporter_phone, reporter_phone),
      reporter_email = COALESCE(p_reporter_email, reporter_email),
      request_source = COALESCE(p_request_source, request_source),
      request_type = COALESCE(p_request_type, request_type),
      operation_type = COALESCE(p_operation_type, operation_type),
      metadata = COALESCE(metadata, '{}'::jsonb) || v_metadata,
      updated_at = now()
    WHERE id = v_existing_id
    RETURNING * INTO v_case;
  ELSE
    INSERT INTO public.cases (
      title,
      description,
      priority,
      pipeline_stage,
      zone,
      latitude,
      longitude,
      address,
      affected_count,
      reporter_name,
      reporter_phone,
      reporter_email,
      category,
      request_source,
      request_type,
      operation_type,
      metadata
    )
    VALUES (
      p_title,
      COALESCE(p_description, ''),
      p_priority,
      'nuevo',
      COALESCE(NULLIF(p_zone, ''), ''),
      p_latitude,
      p_longitude,
      p_address,
      GREATEST(COALESCE(p_affected_count, 1), 1),
      p_reporter_name,
      p_reporter_phone,
      p_reporter_email,
      p_category,
      COALESCE(p_request_source, 'citizen'),
      COALESCE(p_request_type, 'report'),
      COALESCE(p_operation_type, 'incident'),
      v_metadata
    )
    RETURNING * INTO v_case;

    INSERT INTO public.case_events (case_id, event_type, to_stage, actor_id, comment)
    VALUES (
      v_case.id,
      'case_submitted',
      'nuevo',
      auth.uid(),
      CASE
        WHEN p_priority = 'critical' THEN 'Caso crítico recibido — pendiente de revisión'
        ELSE 'Solicitud operativa recibida'
      END
    );
  END IF;

  RETURN v_case;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_operational_case_from_report(
  UUID, TEXT, TEXT, public.case_priority, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
