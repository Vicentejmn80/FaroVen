-- FARO: Catálogo Inteligente de Recursos (V1)
-- Núcleo evolutivo reutilizable por reportes/inventario/misiones/reservas.
-- Implementación incremental: NO elimina `resource_type` aún.

create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- ============================================================
-- 1) Normalización
-- ============================================================
create or replace function public.normalize_item_text(p_input text)
returns text
language sql
immutable
as $$
  select
    trim(
      regexp_replace(
        regexp_replace(
          lower(unaccent(coalesce(p_input, ''))),
          '[^a-z0-9\\s]+',
          ' ',
          'g'
        ),
        '\\s+',
        ' ',
        'g'
      )
    )
$$;

-- ============================================================
-- 2) Tablas: items_catalog + item_aliases
-- ============================================================
create table if not exists public.items_catalog (
  id uuid primary key default gen_random_uuid(),
  -- Identificador estable para compatibilidad (dual-write con resource_type)
  key text unique not null,
  canonical_name text not null,
  normalized_name text not null,
  unit text not null default 'unidades',
  category text,
  status text not null default 'active'
    check (status in ('active', 'pending_review', 'archived', 'rejected')),
  created_from_report_id uuid references public.reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_items_catalog_status on public.items_catalog(status);
create index if not exists idx_items_catalog_normalized_trgm
  on public.items_catalog using gin (normalized_name gin_trgm_ops);

create table if not exists public.item_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items_catalog(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  status text not null default 'active'
    check (status in ('active', 'pending_review', 'archived', 'rejected')),
  created_from_report_id uuid references public.reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

-- Un alias activo no debe duplicarse
create unique index if not exists uq_item_aliases_normalized_active
  on public.item_aliases(normalized_alias)
  where status in ('active', 'pending_review');

create index if not exists idx_item_aliases_item on public.item_aliases(item_id);
create index if not exists idx_item_aliases_normalized_trgm
  on public.item_aliases using gin (normalized_alias gin_trgm_ops);

-- updated_at trigger para items_catalog
create or replace function public.touch_items_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_items_catalog_updated_at on public.items_catalog;
create trigger trg_touch_items_catalog_updated_at
before update on public.items_catalog
for each row execute function public.touch_items_catalog_updated_at();

-- ============================================================
-- 3) Key generator (compatibilidad dual-write)
-- ============================================================
create or replace function public.items_catalog_key_for_name(p_canonical_name text)
returns text
language plpgsql
immutable
as $$
declare
  n text;
  base text;
begin
  n := public.normalize_item_text(p_canonical_name);
  if n is null or n = '' then
    return 'item-' || substring(md5(coalesce(p_canonical_name, '')), 1, 10);
  end if;
  base := replace(n, ' ', '_');
  if length(base) > 48 then
    base := substring(base, 1, 48);
  end if;
  return base;
end;
$$;

create or replace function public.items_catalog_normalize_row()
returns trigger
language plpgsql
as $$
declare
  computed_key text;
begin
  if new.canonical_name is not null then
    new.normalized_name := public.normalize_item_text(new.canonical_name);
  end if;

  if new.key is null or new.key = '' then
    computed_key := public.items_catalog_key_for_name(new.canonical_name);
    -- colisión → sufijo corto determinístico
    if exists(select 1 from public.items_catalog where key = computed_key) then
      computed_key := computed_key || '_' || substring(md5(coalesce(new.canonical_name, '')), 1, 6);
    end if;
    new.key := computed_key;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_items_catalog_normalize_row on public.items_catalog;
create trigger trg_items_catalog_normalize_row
before insert or update on public.items_catalog
for each row execute function public.items_catalog_normalize_row();

create or replace function public.item_aliases_normalize_row()
returns trigger
language plpgsql
as $$
begin
  new.normalized_alias := public.normalize_item_text(new.alias);
  return new;
end;
$$;

drop trigger if exists trg_item_aliases_normalize_row on public.item_aliases;
create trigger trg_item_aliases_normalize_row
before insert or update on public.item_aliases
for each row execute function public.item_aliases_normalize_row();

-- ============================================================
-- 4) Search RPC (autocompletado)
-- ============================================================
create or replace function public.search_items_catalog(
  p_query text,
  p_limit int default 12,
  p_include_pending boolean default false
)
returns table (
  item_id uuid,
  item_key text,
  canonical_name text,
  unit text,
  status text,
  match_kind text,
  match_score real
)
language sql
stable
security definer
set search_path = public
as $$
with q as (
  select public.normalize_item_text(p_query) as nq
),
eligible_items as (
  select *
  from public.items_catalog
  where (p_include_pending or status = 'active')
),
eligible_aliases as (
  select a.*
  from public.item_aliases a
  join eligible_items i on i.id = a.item_id
  where (p_include_pending or a.status = 'active')
),
exact_alias as (
  select
    a.item_id,
    i.key as item_key,
    i.canonical_name,
    i.unit,
    i.status,
    'exact_alias'::text as match_kind,
    1.0::real as match_score
  from eligible_aliases a
  join eligible_items i on i.id = a.item_id
  join q on true
  where a.normalized_alias = q.nq and q.nq <> ''
),
exact_name as (
  select
    i.id as item_id,
    i.key as item_key,
    i.canonical_name,
    i.unit,
    i.status,
    'exact_name'::text as match_kind,
    1.0::real as match_score
  from eligible_items i
  join q on true
  where i.normalized_name = q.nq and q.nq <> ''
),
fuzzy_alias as (
  select
    a.item_id,
    i.key as item_key,
    i.canonical_name,
    i.unit,
    i.status,
    'fuzzy_alias'::text as match_kind,
    similarity(a.normalized_alias, q.nq)::real as match_score
  from eligible_aliases a
  join eligible_items i on i.id = a.item_id
  join q on true
  where q.nq <> ''
  order by similarity(a.normalized_alias, q.nq) desc
  limit greatest(p_limit, 12)
),
fuzzy_name as (
  select
    i.id as item_id,
    i.key as item_key,
    i.canonical_name,
    i.unit,
    i.status,
    'fuzzy_name'::text as match_kind,
    similarity(i.normalized_name, q.nq)::real as match_score
  from eligible_items i
  join q on true
  where q.nq <> ''
  order by similarity(i.normalized_name, q.nq) desc
  limit greatest(p_limit, 12)
),
unioned as (
  select * from exact_alias
  union all
  select * from exact_name
  union all
  select * from fuzzy_alias
  union all
  select * from fuzzy_name
),
ranked as (
  select
    u.*,
    row_number() over (partition by u.item_id order by u.match_score desc) as rn
  from unioned u
)
select item_id, item_key, canonical_name, unit, status, match_kind, match_score
from ranked
where rn = 1
order by match_score desc
limit p_limit;
$$;

revoke all on function public.search_items_catalog(text, int, boolean) from public;
grant execute on function public.search_items_catalog(text, int, boolean) to anon, authenticated;

-- ============================================================
-- 5) RLS (lectura pública; escritura solo operadores)
-- ============================================================
alter table public.items_catalog enable row level security;
alter table public.item_aliases enable row level security;

drop policy if exists items_catalog_select_all on public.items_catalog;
create policy items_catalog_select_all on public.items_catalog
  for select to anon, authenticated
  using (true);

drop policy if exists items_catalog_insert_ops on public.items_catalog;
create policy items_catalog_insert_ops on public.items_catalog
  for insert to authenticated
  with check (public.is_network_operator());

drop policy if exists items_catalog_update_ops on public.items_catalog;
create policy items_catalog_update_ops on public.items_catalog
  for update to authenticated
  using (public.is_network_operator())
  with check (public.is_network_operator());

drop policy if exists item_aliases_select_all on public.item_aliases;
create policy item_aliases_select_all on public.item_aliases
  for select to anon, authenticated
  using (true);

drop policy if exists item_aliases_insert_ops on public.item_aliases;
create policy item_aliases_insert_ops on public.item_aliases
  for insert to authenticated
  with check (public.is_network_operator());

drop policy if exists item_aliases_update_ops on public.item_aliases;
create policy item_aliases_update_ops on public.item_aliases
  for update to authenticated
  using (public.is_network_operator())
  with check (public.is_network_operator());

-- Realtime (opcional, pero útil para autocompletado en vivo)
do $$ begin
  alter publication supabase_realtime add table public.items_catalog;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.item_aliases;
exception when duplicate_object then null;
end $$;

