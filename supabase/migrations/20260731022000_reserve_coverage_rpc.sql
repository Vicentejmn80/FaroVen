-- Reserva atómica de cobertura parcial en convocatorias públicas
create or replace function public.reserve_coverage(
  p_public_need_id uuid,
  p_quantity numeric,
  p_collaborator_name text default null,
  p_collaborator_type text default 'citizen'
)
returns public.coverage_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_need public.public_needs;
  v_committed numeric(12,2);
  v_row public.coverage_reservations;
  v_user uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select * into v_need
  from public.public_needs
  where id = p_public_need_id
  for update;

  if not found then
    raise exception 'Convocatoria no encontrada';
  end if;

  if v_need.call_status <> 'open' then
    raise exception 'La convocatoria está cerrada';
  end if;

  select coalesce(sum(quantity), 0)
    into v_committed
  from public.coverage_reservations
  where public_need_id = p_public_need_id
    and status in ('reserved', 'confirmed', 'under_review');

  if v_committed + p_quantity > v_need.required_quantity then
    raise exception 'Cantidad excede lo pendiente por cubrir';
  end if;

  v_user := auth.uid();

  insert into public.coverage_reservations (
    public_need_id,
    collaborator_user_id,
    collaborator_name,
    collaborator_type,
    quantity,
    status
  )
  values (
    p_public_need_id,
    v_user,
    p_collaborator_name,
    coalesce(p_collaborator_type, 'citizen'),
    p_quantity,
    'reserved'
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.reserve_coverage(uuid, numeric, text, text) to authenticated;
