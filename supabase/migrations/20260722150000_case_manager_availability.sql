-- Disponibilidad Operacional — Gestor de Casos
-- Tabla ligera para indicar disponibilidad semanal

create table if not exists public.case_manager_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  hour smallint not null check (hour >= 0 and hour <= 23),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique: una fila por usuario/día/hora
create unique index if not exists idx_cm_avail_user_date_hour
  on public.case_manager_availability (user_id, date, hour);

-- Índice para consultas por semana
create index if not exists idx_cm_avail_user_week
  on public.case_manager_availability (user_id, date);

-- Realtime
alter publication supabase_realtime add table public.case_manager_availability;

-- RLS
alter table public.case_manager_availability enable row level security;

-- Propio usuario: lectura/escritura
create policy cm_avail_self_select on public.case_manager_availability
  for select using (auth.uid() = user_id);

create policy cm_avail_self_insert on public.case_manager_availability
  for insert with check (auth.uid() = user_id);

create policy cm_avail_self_update on public.case_manager_availability
  for update using (auth.uid() = user_id);

create policy cm_avail_self_delete on public.case_manager_availability
  for delete using (auth.uid() = user_id);

-- Admins: solo lectura
create policy cm_avail_admin_select on public.case_manager_availability
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('regional_admin', 'super_admin', 'case_manager')
    )
  );

-- Trigger updated_at
create or replace function public.update_cm_avail_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_cm_avail_updated_at
  before update on public.case_manager_availability
  for each row execute function public.update_cm_avail_timestamp();
