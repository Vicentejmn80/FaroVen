-- ÉPICA 08 — Public Needs & Verification Workflow V1
-- Extensión aditiva: no reemplaza flujos existentes de reports/cases/missions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper role function (scope: operador de red)
-- ---------------------------------------------------------------------------
create or replace function public.is_network_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('case_manager', 'coordinator', 'regional_admin', 'super_admin')
  );
$$;

grant execute on function public.is_network_operator() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Public Needs (capa pública)
-- ---------------------------------------------------------------------------
create table if not exists public.public_needs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  title text not null,
  summary text not null default '',
  category text not null default 'humanitarian',
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  location_public jsonb not null default '{}'::jsonb,
  location_private jsonb,
  required_quantity numeric(12,2) not null default 1 check (required_quantity > 0),
  covered_quantity numeric(12,2) not null default 0 check (covered_quantity >= 0),
  remaining_quantity numeric(12,2) generated always as (greatest(required_quantity - covered_quantity, 0)) stored,
  unit text not null default 'unidad',
  verification_status text not null default 'pending_entry'
    check (verification_status in ('pending_entry', 'approved_entry', 'rejected_entry', 'pending_exit', 'approved_exit', 'rejected_exit')),
  visibility_status text not null default 'hidden'
    check (visibility_status in ('hidden', 'public', 'restricted')),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'reserved', 'in_progress', 'completed', 'expired', 'closed', 'archived')),
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_needs_status on public.public_needs(status);
create index if not exists idx_public_needs_visibility on public.public_needs(visibility_status);
create index if not exists idx_public_needs_expires_at on public.public_needs(expires_at);
create index if not exists idx_public_needs_report_id on public.public_needs(report_id);
create index if not exists idx_public_needs_case_id on public.public_needs(case_id);

-- ---------------------------------------------------------------------------
-- Coverage reservations (intención de ayuda)
-- ---------------------------------------------------------------------------
create table if not exists public.coverage_reservations (
  id uuid primary key default gen_random_uuid(),
  public_need_id uuid not null references public.public_needs(id) on delete cascade,
  collaborator_user_id uuid references auth.users(id) on delete set null,
  collaborator_name text,
  collaborator_type text not null default 'citizen'
    check (collaborator_type in ('citizen', 'volunteer', 'organization', 'coordinator')),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_coverage_reservations_need on public.coverage_reservations(public_need_id);
create index if not exists idx_coverage_reservations_status on public.coverage_reservations(status);
create index if not exists idx_coverage_reservations_expires on public.coverage_reservations(expires_at);

-- ---------------------------------------------------------------------------
-- Need verification (entrada / salida)
-- ---------------------------------------------------------------------------
create table if not exists public.need_verifications (
  id uuid primary key default gen_random_uuid(),
  public_need_id uuid not null references public.public_needs(id) on delete cascade,
  verification_type text not null check (verification_type in ('entry', 'exit')),
  checklist jsonb not null default '[]'::jsonb,
  decision text not null check (decision in ('approved', 'rejected', 'needs_info')),
  notes text,
  verified_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_need_verifications_need on public.need_verifications(public_need_id);
create index if not exists idx_need_verifications_type on public.need_verifications(verification_type);

-- ---------------------------------------------------------------------------
-- Need timeline (trazabilidad pública-operacional)
-- ---------------------------------------------------------------------------
create table if not exists public.need_timelines (
  id uuid primary key default gen_random_uuid(),
  public_need_id uuid not null references public.public_needs(id) on delete cascade,
  event_type text not null,
  detail text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_need_timelines_need on public.need_timelines(public_need_id);
create index if not exists idx_need_timelines_created on public.need_timelines(created_at desc);

-- ---------------------------------------------------------------------------
-- Success cases (salida verificada)
-- ---------------------------------------------------------------------------
create table if not exists public.success_cases (
  id uuid primary key default gen_random_uuid(),
  public_need_id uuid not null references public.public_needs(id) on delete restrict,
  case_id uuid references public.cases(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  public_code text not null unique,
  zone text not null default '',
  help_type text not null default 'humanitarian',
  collaborator_type text not null default 'mixed'
    check (collaborator_type in ('citizen', 'volunteer', 'organization', 'mixed')),
  impact_summary text not null default '',
  evidence_urls text[] not null default '{}',
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  total_duration_minutes integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_success_cases_need on public.success_cases(public_need_id);
create index if not exists idx_success_cases_verified_at on public.success_cases(verified_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_public_need_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_public_need_updated_at on public.public_needs;
create trigger trg_touch_public_need_updated_at
before update on public.public_needs
for each row
execute function public.touch_public_need_updated_at();

create or replace function public.sync_public_need_coverage()
returns trigger
language plpgsql
as $$
declare
  target_need uuid;
  confirmed_qty numeric(12,2);
begin
  target_need := coalesce(new.public_need_id, old.public_need_id);

  select coalesce(sum(quantity), 0)
    into confirmed_qty
  from public.coverage_reservations
  where public_need_id = target_need
    and status = 'confirmed';

  update public.public_needs
  set
    covered_quantity = confirmed_qty,
    status = case
      when status in ('closed', 'archived') then status
      when expires_at < now() then 'expired'
      when confirmed_qty >= required_quantity then 'completed'
      when confirmed_qty > 0 then 'in_progress'
      else 'active'
    end,
    updated_at = now()
  where id = target_need;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_public_need_coverage_ins on public.coverage_reservations;
drop trigger if exists trg_sync_public_need_coverage_upd on public.coverage_reservations;
drop trigger if exists trg_sync_public_need_coverage_del on public.coverage_reservations;

create trigger trg_sync_public_need_coverage_ins
after insert on public.coverage_reservations
for each row
execute function public.sync_public_need_coverage();

create trigger trg_sync_public_need_coverage_upd
after update on public.coverage_reservations
for each row
execute function public.sync_public_need_coverage();

create trigger trg_sync_public_need_coverage_del
after delete on public.coverage_reservations
for each row
execute function public.sync_public_need_coverage();

create or replace function public.expire_public_need_entities()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  update public.coverage_reservations
  set status = 'expired'
  where status = 'reserved'
    and expires_at < now();

  update public.public_needs
  set status = 'expired'
  where status in ('active', 'reserved', 'in_progress')
    and expires_at < now();

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.expire_public_need_entities() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.public_needs enable row level security;
alter table public.coverage_reservations enable row level security;
alter table public.need_verifications enable row level security;
alter table public.need_timelines enable row level security;
alter table public.success_cases enable row level security;

-- Public Needs: lectura pública de necesidades visibles
drop policy if exists public_needs_select_public on public.public_needs;
create policy public_needs_select_public on public.public_needs
for select
to anon, authenticated
using (
  visibility_status = 'public'
  and status in ('active', 'reserved', 'in_progress', 'completed')
  and expires_at > (now() - interval '24 hours')
);

drop policy if exists public_needs_ops_all on public.public_needs;
create policy public_needs_ops_all on public.public_needs
for all
to authenticated
using (public.is_network_operator())
with check (public.is_network_operator());

-- Reservations: intención de ayuda pública + gestión operativa
drop policy if exists coverage_reservations_insert_public on public.coverage_reservations;
create policy coverage_reservations_insert_public on public.coverage_reservations
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.public_needs n
    where n.id = public_need_id
      and n.visibility_status = 'public'
      and n.status in ('active', 'reserved', 'in_progress')
      and n.expires_at > now()
  )
);

drop policy if exists coverage_reservations_select_self on public.coverage_reservations;
create policy coverage_reservations_select_self on public.coverage_reservations
for select
to authenticated
using (collaborator_user_id = auth.uid());

drop policy if exists coverage_reservations_ops_all on public.coverage_reservations;
create policy coverage_reservations_ops_all on public.coverage_reservations
for all
to authenticated
using (public.is_network_operator())
with check (public.is_network_operator());

-- Verifications: solo operadores
drop policy if exists need_verifications_ops_all on public.need_verifications;
create policy need_verifications_ops_all on public.need_verifications
for all
to authenticated
using (public.is_network_operator())
with check (public.is_network_operator());

-- Timelines: lectura pública / gestión operadores
drop policy if exists need_timelines_select_public on public.need_timelines;
create policy need_timelines_select_public on public.need_timelines
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.public_needs n
    where n.id = public_need_id
      and n.visibility_status = 'public'
  )
);

drop policy if exists need_timelines_ops_all on public.need_timelines;
create policy need_timelines_ops_all on public.need_timelines
for all
to authenticated
using (public.is_network_operator())
with check (public.is_network_operator());

-- Success cases: lectura pública / escritura operadores
drop policy if exists success_cases_select_public on public.success_cases;
create policy success_cases_select_public on public.success_cases
for select
to anon, authenticated
using (true);

drop policy if exists success_cases_ops_all on public.success_cases;
create policy success_cases_ops_all on public.success_cases
for all
to authenticated
using (public.is_network_operator())
with check (public.is_network_operator());

-- Grants
grant select on public.public_needs to anon, authenticated;
grant insert on public.coverage_reservations to anon, authenticated;
grant select on public.coverage_reservations to authenticated;
grant select on public.need_timelines to anon, authenticated;
grant select on public.success_cases to anon, authenticated;

grant insert, update, delete on public.public_needs to authenticated;
grant insert, update, delete on public.need_verifications to authenticated;
grant insert, update, delete on public.need_timelines to authenticated;
grant insert, update, delete on public.success_cases to authenticated;
grant update, delete on public.coverage_reservations to authenticated;

-- Realtime
alter publication supabase_realtime add table public.public_needs;
alter publication supabase_realtime add table public.coverage_reservations;
alter publication supabase_realtime add table public.need_timelines;
alter publication supabase_realtime add table public.success_cases;

