-- FARO: Vincular reportes con items_catalog (item_id) + sugerencias automáticas pending_review
-- Ciudadano NO crea items oficiales; si no existe, se crea sugerencia vinculada al reporte.

create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- ============================================================
-- 1) Columnas nuevas en reports
-- ============================================================
alter table public.reports
  add column if not exists item_text text,
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null,
  add column if not exists item_match_kind text,
  add column if not exists item_match_score real;

create index if not exists idx_reports_item_id on public.reports(item_id);

-- ============================================================
-- 2) Resolver / crear sugerencia (SECURITY DEFINER)
-- ============================================================
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
  v_norm text;
  v_item_id uuid;
  v_kind text;
  v_score real;
begin
  v_norm := public.normalize_item_text(p_item_text);

  if v_norm is null or v_norm = '' or length(v_norm) < 3 then
    return;
  end if;

  -- 1) Exact alias (active)
  select a.item_id
    into v_item_id
  from public.item_aliases a
  join public.items_catalog i on i.id = a.item_id
  where a.status = 'active'
    and i.status = 'active'
    and a.normalized_alias = v_norm
  limit 1;

  if v_item_id is not null then
    v_kind := 'exact_alias';
    v_score := 1.0;
  else
    -- 2) Exact name (active)
    select i.id
      into v_item_id
    from public.items_catalog i
    where i.status = 'active'
      and i.normalized_name = v_norm
    limit 1;

    if v_item_id is not null then
      v_kind := 'exact_name';
      v_score := 1.0;
    else
      -- 3) Fuzzy alias/name (trgm)
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
  end if;

  -- Si no hay match → crear sugerencia pending_review vinculada al reporte
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
      public.items_catalog_key_for_name(p_item_text),
      trim(p_item_text),
      public.normalize_item_text(p_item_text),
      'unidades',
      null,
      'pending_review',
      p_report_id,
      auth.uid()
    )
    returning id into v_item_id;

    insert into public.item_aliases (
      item_id,
      alias,
      normalized_alias,
      status,
      created_from_report_id,
      created_by
    ) values (
      v_item_id,
      trim(p_item_text),
      public.normalize_item_text(p_item_text),
      'pending_review',
      p_report_id,
      auth.uid()
    )
    on conflict do nothing;

    v_kind := 'created_pending';
    v_score := 1.0;
  else
    -- Aprendizaje: si el texto no existía como alias, guardarlo como pending_review para revisión
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
        trim(p_item_text),
        v_norm,
        'pending_review',
        p_report_id,
        auth.uid()
      )
      on conflict do nothing;
    end if;
  end if;

  -- persistir en report
  update public.reports
  set
    item_text = coalesce(item_text, trim(p_item_text)),
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

revoke all on function public.resolve_item_for_report(uuid, text) from public;
grant execute on function public.resolve_item_for_report(uuid, text) to anon, authenticated;

-- ============================================================
-- 3) Trigger: resolver item al insertar report
-- ============================================================
create or replace function public.trg_reports_resolve_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  candidate := nullif(trim(coalesce(new.item_text, '')), '');

  if candidate is null then
    -- fallback heurístico mínimo desde descripción (no IA)
    -- toma primeros ~60 chars antes de un separador común
    if new.description is not null then
      candidate := split_part(new.description, '—', 1);
      candidate := nullif(trim(candidate), '');
    end if;
  end if;

  if candidate is not null then
    perform * from public.resolve_item_for_report(new.id, candidate);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_resolve_item_after_insert on public.reports;
create trigger trg_reports_resolve_item_after_insert
after insert on public.reports
for each row execute function public.trg_reports_resolve_item();

