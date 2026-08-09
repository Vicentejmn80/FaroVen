-- Fix: citizen report insert 409 when item_text maps to an existing items_catalog.key
-- Root cause: resolve_item_for_report only matched status='active', then INSERTed blindly
-- and hit unique constraint items_catalog_key_key (e.g. "Agua potable" → agua_potable).

create or replace function public.resolve_item_for_report(
  p_report_id uuid,
  p_item_text text
)
returns table (
  out_item_id uuid,
  out_match_kind text,
  out_match_score real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_norm text;
  v_key text;
  v_item_id uuid;
  v_kind text;
  v_score real;
begin
  -- a) Normalizar texto / key antes de cualquier operación
  v_raw := trim(coalesce(p_item_text, ''));
  if v_raw = '' then
    return;
  end if;

  v_norm := public.normalize_item_text(v_raw);
  -- key canónica del catálogo (trim/lower/unaccent + espacios→_)
  v_key := public.items_catalog_key_for_name(v_raw);

  if v_norm is null or v_norm = '' or length(v_norm) < 3 then
    return;
  end if;

  -- b/c) Buscar primero por key (cualquier status: active | pending_review | …)
  select i.id
    into v_item_id
  from public.items_catalog i
  where i.key = v_key
  limit 1;

  if v_item_id is not null then
    v_kind := 'existing_key';
    v_score := 1.0;
  else
    -- nombre normalizado, cualquier status
    select i.id
      into v_item_id
    from public.items_catalog i
    where i.normalized_name = v_norm
    order by case when i.status = 'active' then 0 else 1 end
    limit 1;

    if v_item_id is not null then
      v_kind := 'exact_name';
      v_score := 1.0;
    end if;
  end if;

  -- alias exacto (active o pending_review)
  if v_item_id is null then
    select a.item_id
      into v_item_id
    from public.item_aliases a
    join public.items_catalog i on i.id = a.item_id
    where a.normalized_alias = v_norm
      and a.status in ('active', 'pending_review')
    order by case when a.status = 'active' then 0 else 1 end
    limit 1;

    if v_item_id is not null then
      v_kind := 'exact_alias';
      v_score := 1.0;
    end if;
  end if;

  -- fuzzy solo sobre activos (comportamiento previo)
  if v_item_id is null then
    select a.item_id, similarity(a.normalized_alias, v_norm)::real
      into v_item_id, v_score
    from public.item_aliases a
    join public.items_catalog i on i.id = a.item_id
    where a.status = 'active'
      and i.status = 'active'
    order by similarity(a.normalized_alias, v_norm) desc
    limit 1;

    if v_item_id is not null and coalesce(v_score, 0) >= 0.45 then
      v_kind := 'fuzzy_alias';
    else
      v_item_id := null;
      v_score := null;

      select i.id, similarity(i.normalized_name, v_norm)::real
        into v_item_id, v_score
      from public.items_catalog i
      where i.status = 'active'
      order by similarity(i.normalized_name, v_norm) desc
      limit 1;

      if v_item_id is not null and coalesce(v_score, 0) >= 0.45 then
        v_kind := 'fuzzy_name';
      else
        v_item_id := null;
        v_kind := null;
        v_score := null;
      end if;
    end if;
  end if;

  -- d) Si NO existe: INSERT tolerante a duplicados, luego SELECT del id
  if v_item_id is null then
    insert into public.items_catalog (
      key,
      canonical_name,
      normalized_name,
      unit,
      category,
      status,
      created_from_report_id,
      created_by
    ) values (
      v_key,
      v_raw,
      v_norm,
      'unidades',
      null,
      'pending_review',
      p_report_id,
      auth.uid()
    )
    on conflict (key) do nothing;

    select i.id
      into v_item_id
    from public.items_catalog i
    where i.key = v_key
    limit 1;

    if v_item_id is null then
      -- no bloquear el reporte ciudadano si el catálogo no pudo materializarse
      return;
    end if;

    insert into public.item_aliases (
      item_id,
      alias,
      normalized_alias,
      status,
      created_from_report_id,
      created_by
    ) values (
      v_item_id,
      v_raw,
      v_norm,
      'pending_review',
      p_report_id,
      auth.uid()
    )
    on conflict do nothing;

    v_kind := 'created_pending';
    v_score := 1.0;
  else
    -- aprendizaje de alias (no debe tumbar el reporte)
    if not exists (
      select 1
      from public.item_aliases a
      where a.normalized_alias = v_norm
        and a.status in ('active', 'pending_review')
    ) then
      insert into public.item_aliases (
        item_id,
        alias,
        normalized_alias,
        status,
        created_from_report_id,
        created_by
      ) values (
        v_item_id,
        v_raw,
        v_norm,
        'pending_review',
        p_report_id,
        auth.uid()
      )
      on conflict do nothing;
    end if;
  end if;

  -- e) Vincular item_id al reporte
  update public.reports
  set
    item_text = coalesce(item_text, v_raw),
    item_id = v_item_id,
    item_match_kind = v_kind,
    item_match_score = v_score
  where id = p_report_id;

  out_item_id := v_item_id;
  out_match_kind := v_kind;
  out_match_score := v_score;
  return next;
end;
$$;

comment on function public.resolve_item_for_report(uuid, text) is
  'Resuelve item_text de un reporte hacia items_catalog sin 409 por key duplicada. Busca por key/nombre/alias en cualquier status antes de insertar.';
