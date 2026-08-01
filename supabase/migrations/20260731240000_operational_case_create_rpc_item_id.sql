-- Wizard Operativo: extender RPC create_operational_case_from_report para soportar item_id (Catálogo Inteligente)
-- Mantiene compatibilidad con category/resource_type durante transición.

-- Firma anterior (sin item_id) — eliminar para evitar overloads ambiguos desde TS.
drop function if exists public.create_operational_case_from_report(
  UUID, TEXT, TEXT, public.case_priority, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
);

create or replace function public.create_operational_case_from_report(
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
  p_item_id UUID DEFAULT NULL,
  p_reporter_name TEXT DEFAULT NULL,
  p_reporter_phone TEXT DEFAULT NULL,
  p_reporter_email TEXT DEFAULT NULL,
  p_request_source TEXT DEFAULT 'citizen',
  p_request_type TEXT DEFAULT 'report',
  p_operation_type TEXT DEFAULT 'incident',
  p_wizard_metadata JSONB DEFAULT NULL
)
returns public.cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.cases%rowtype;
  v_metadata jsonb;
  v_existing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_network_operator() then
    raise exception 'not_authorized';
  end if;

  select c.id
    into v_existing_id
  from public.cases c
  where c.metadata->>'report_id' = p_report_id::text
    and c.pipeline_stage not in ('archived', 'resolved')
  order by c.created_at desc
  limit 1;

  v_metadata := jsonb_build_object('report_id', p_report_id::text);
  if p_wizard_metadata is not null then
    v_metadata := v_metadata || jsonb_build_object('wizard', p_wizard_metadata);
  end if;

  if v_existing_id is not null then
    update public.cases
    set
      title = p_title,
      description = coalesce(p_description, ''),
      priority = p_priority,
      zone = coalesce(nullif(p_zone, ''), zone, ''),
      latitude = p_latitude,
      longitude = p_longitude,
      address = coalesce(p_address, address),
      category = p_category,
      item_id = coalesce(p_item_id, item_id),
      affected_count = greatest(coalesce(p_affected_count, 1), 1),
      reporter_name = coalesce(p_reporter_name, reporter_name),
      reporter_phone = coalesce(p_reporter_phone, reporter_phone),
      reporter_email = coalesce(p_reporter_email, reporter_email),
      request_source = coalesce(p_request_source, request_source),
      request_type = coalesce(p_request_type, request_type),
      operation_type = coalesce(p_operation_type, operation_type),
      metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
      updated_at = now()
    where id = v_existing_id
    returning * into v_case;
  else
    insert into public.cases (
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
      item_id,
      request_source,
      request_type,
      operation_type,
      metadata
    )
    values (
      p_title,
      coalesce(p_description, ''),
      p_priority,
      'nuevo',
      coalesce(nullif(p_zone, ''), ''),
      p_latitude,
      p_longitude,
      p_address,
      greatest(coalesce(p_affected_count, 1), 1),
      p_reporter_name,
      p_reporter_phone,
      p_reporter_email,
      p_category,
      p_item_id,
      coalesce(p_request_source, 'citizen'),
      coalesce(p_request_type, 'report'),
      coalesce(p_operation_type, 'incident'),
      v_metadata
    )
    returning * into v_case;

    insert into public.case_events (case_id, event_type, to_stage, actor_id, comment)
    values (
      v_case.id,
      'case_submitted',
      'nuevo',
      auth.uid(),
      case
        when p_priority = 'critical' then 'Caso crítico recibido — pendiente de revisión'
        else 'Solicitud operativa recibida'
      end
    );
  end if;

  return v_case;
end;
$$;

grant execute on function public.create_operational_case_from_report(
  UUID, TEXT, TEXT, public.case_priority, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER, UUID,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) to authenticated;

