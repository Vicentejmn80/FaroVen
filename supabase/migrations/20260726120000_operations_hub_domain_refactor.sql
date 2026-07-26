-- Operations Hub domain refactor:
-- report -> case -> need -> call -> application -> mission.

alter table public.reports
  drop constraint if exists reports_status_check;

create index if not exists idx_reports_converted_created
  on public.reports (created_at desc)
  where status = 'converted';

alter table public.public_needs
  add column if not exists call_status text not null default 'closed'
    check (call_status in ('open', 'closed', 'complete'));

comment on column public.public_needs.call_status is
  'Convocatoria: open allows volunteer applications, closed hides it from volunteers, complete stops new applications.';

create index if not exists idx_public_needs_call_status
  on public.public_needs (call_status, status, created_at desc);

drop policy if exists public_needs_select_public on public.public_needs;
create policy public_needs_select_public on public.public_needs
for select
to anon, authenticated
using (
  visibility_status = 'public'
  and call_status = 'open'
  and status in ('active', 'reserved', 'in_progress')
  and expires_at > (now() - interval '24 hours')
);

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
      and n.call_status = 'open'
      and n.status in ('active', 'reserved', 'in_progress')
      and n.remaining_quantity > 0
      and n.expires_at > now()
  )
);

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
    call_status = case
      when status in ('closed', 'archived') then call_status
      when confirmed_qty >= required_quantity then 'complete'
      else call_status
    end,
    visibility_status = case
      when confirmed_qty >= required_quantity then 'hidden'
      else visibility_status
    end,
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
