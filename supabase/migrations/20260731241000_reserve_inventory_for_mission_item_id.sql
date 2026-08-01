-- FARO: Extender RPC reserve_inventory_for_mission para soportar item_id (dual-write)

drop function if exists public.reserve_inventory_for_mission(uuid, uuid, text, text, int, text, int);

create or replace function public.reserve_inventory_for_mission(
  p_mission_id uuid,
  p_case_id uuid,
  p_center_id text,
  p_resource_type text,
  p_quantity int,
  p_item_id uuid default null,
  p_volunteer_id text default null,
  p_ttl_minutes int default 20
)
returns public.inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.center_resources;
  v_available int;
  v_res public.inventory_reservations;
  v_user uuid := auth.uid();
  v_ttl int := greatest(coalesce(p_ttl_minutes, 20), 1);
  v_item uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  if v_user is null then
    raise exception 'Se requiere autenticación';
  end if;

  select * into v_row
  from public.center_resources
  where center_id = p_center_id
    and resource_type = p_resource_type
  for update;

  if not found then
    raise exception 'El centro no tiene ese recurso en inventario';
  end if;

  v_available := greatest(coalesce(v_row.current_level, 0) - coalesce(v_row.reserved_level, 0), 0);
  if p_quantity > v_available then
    raise exception 'Cantidad excede el inventario disponible (% restantes)', v_available;
  end if;

  v_item := coalesce(p_item_id, v_row.item_id);
  if v_item is null then
    select i.id into v_item
    from public.items_catalog i
    where i.key = p_resource_type
    limit 1;
  end if;

  insert into public.inventory_reservations (
    mission_id,
    case_id,
    center_id,
    resource_type,
    item_id,
    quantity,
    status,
    volunteer_id,
    volunteer_user_id,
    expires_at
  )
  values (
    p_mission_id,
    p_case_id,
    p_center_id,
    p_resource_type,
    v_item,
    p_quantity,
    'reserved',
    p_volunteer_id,
    v_user,
    now() + make_interval(mins => v_ttl)
  )
  returning * into v_res;

  return v_res;
end;
$$;

grant execute on function public.reserve_inventory_for_mission(uuid, uuid, text, text, int, uuid, text, int)
  to authenticated;

