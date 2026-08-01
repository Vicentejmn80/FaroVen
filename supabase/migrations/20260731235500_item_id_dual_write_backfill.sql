-- FARO: Dual-write `item_id` (items_catalog) en tablas operativas
-- Mantiene compatibilidad con `resource_type` durante transición.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) Columnas `item_id` (aditivas)
-- ============================================================
alter table public.center_resources
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

alter table public.center_inventory_movements
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

alter table public.inventory_reservations
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

alter table public.missions
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

alter table public.cases
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

alter table public.public_needs
  add column if not exists item_id uuid references public.items_catalog(id) on delete set null;

create index if not exists idx_center_resources_item_id on public.center_resources(item_id);
create index if not exists idx_inv_movements_item_id on public.center_inventory_movements(item_id);
create index if not exists idx_inventory_reservations_item_id on public.inventory_reservations(item_id);
create index if not exists idx_missions_item_id on public.missions(item_id);
create index if not exists idx_cases_item_id on public.cases(item_id);
create index if not exists idx_public_needs_item_id on public.public_needs(item_id);

-- ============================================================
-- 2) Seed inicial desde catálogo actual (compat)
-- ============================================================
-- NOTA: keys estables para mantener `resource_type` funcionando.
insert into public.items_catalog (key, canonical_name, normalized_name, unit, category, status)
values
  ('agua', 'Agua', public.normalize_item_text('Agua'), 'unidades', 'alimentos', 'active'),
  ('harina', 'Harina', public.normalize_item_text('Harina'), 'unidades', 'alimentos', 'active'),
  ('arroz', 'Arroz', public.normalize_item_text('Arroz'), 'unidades', 'alimentos', 'active'),
  ('aceite', 'Aceite', public.normalize_item_text('Aceite'), 'unidades', 'alimentos', 'active'),
  ('pasta', 'Pasta', public.normalize_item_text('Pasta'), 'unidades', 'alimentos', 'active'),
  ('leche', 'Leche', public.normalize_item_text('Leche'), 'unidades', 'alimentos', 'active'),
  ('alimentos', 'Alimentos (general)', public.normalize_item_text('Alimentos'), 'raciones', 'alimentos', 'active'),
  ('leche_infantil', 'Leche infantil', public.normalize_item_text('Leche infantil'), 'unidades', 'nutricion_infantil', 'active'),
  ('panales', 'Pañales', public.normalize_item_text('Pañales'), 'unidades', 'nutricion_infantil', 'active'),
  ('medicamentos', 'Medicamentos (general)', public.normalize_item_text('Medicamentos'), 'unidades', 'medicamentos', 'active'),
  ('paracetamol', 'Paracetamol', public.normalize_item_text('Paracetamol'), 'unidades', 'medicamentos', 'active'),
  ('ibuprofeno', 'Ibuprofeno', public.normalize_item_text('Ibuprofeno'), 'unidades', 'medicamentos', 'active'),
  ('insulina', 'Insulina', public.normalize_item_text('Insulina'), 'unidades', 'medicamentos', 'active'),
  ('loratadina', 'Loratadina', public.normalize_item_text('Loratadina'), 'unidades', 'medicamentos', 'active'),
  ('guantes', 'Guantes', public.normalize_item_text('Guantes'), 'unidades', 'material_medico', 'active'),
  ('jeringas', 'Jeringas', public.normalize_item_text('Jeringas'), 'unidades', 'material_medico', 'active'),
  ('gasas', 'Gasas', public.normalize_item_text('Gasas'), 'unidades', 'material_medico', 'active'),
  ('suero', 'Suero', public.normalize_item_text('Suero'), 'unidades', 'material_medico', 'active'),
  ('colchones', 'Colchones', public.normalize_item_text('Colchones'), 'unidades', 'logistica', 'active'),
  ('cobijas', 'Cobijas', public.normalize_item_text('Cobijas'), 'unidades', 'logistica', 'active'),
  ('linternas', 'Linternas', public.normalize_item_text('Linternas'), 'unidades', 'logistica', 'active'),
  ('baterias', 'Baterías', public.normalize_item_text('Baterías'), 'unidades', 'logistica', 'active'),
  ('beds', 'Camas', public.normalize_item_text('Camas'), 'camas', 'logistica', 'active'),
  ('palas', 'Palas', public.normalize_item_text('Palas'), 'unidades', 'herramientas', 'active'),
  ('picos', 'Picos', public.normalize_item_text('Picos'), 'unidades', 'herramientas', 'active'),
  ('martillos', 'Martillos', public.normalize_item_text('Martillos'), 'unidades', 'herramientas', 'active'),
  ('herramientas', 'Herramientas (general)', public.normalize_item_text('Herramientas'), 'unidades', 'herramientas', 'active'),
  ('psicologos', 'Psicólogos', public.normalize_item_text('Psicólogos'), 'personas', 'apoyo', 'active'),
  ('trabajadores_sociales', 'Trabajadores Sociales', public.normalize_item_text('Trabajadores Sociales'), 'personas', 'apoyo', 'active'),
  ('medicos', 'Médicos', public.normalize_item_text('Médicos'), 'personas', 'apoyo', 'active'),
  ('enfermeros', 'Enfermeros', public.normalize_item_text('Enfermeros'), 'personas', 'apoyo', 'active'),
  ('personnel', 'Personal disponible', public.normalize_item_text('Personal disponible'), 'personas', 'apoyo', 'active')
on conflict (key) do nothing;

-- Aliases legacy → canonical
insert into public.item_aliases(item_id, alias, normalized_alias, status)
select i.id, 'water', public.normalize_item_text('water'), 'active'
from public.items_catalog i
where i.key = 'agua'
on conflict do nothing;

insert into public.item_aliases(item_id, alias, normalized_alias, status)
select i.id, 'medicine', public.normalize_item_text('medicine'), 'active'
from public.items_catalog i
where i.key = 'medicamentos'
on conflict do nothing;

insert into public.item_aliases(item_id, alias, normalized_alias, status)
select i.id, 'food', public.normalize_item_text('food'), 'active'
from public.items_catalog i
where i.key = 'alimentos'
on conflict do nothing;

-- ============================================================
-- 3) Backfill item_id desde resource_type/category (best-effort)
-- ============================================================
update public.center_resources cr
set item_id = i.id
from public.items_catalog i
where cr.item_id is null
  and cr.resource_type = i.key;

update public.center_inventory_movements m
set item_id = i.id
from public.items_catalog i
where m.item_id is null
  and m.resource_type = i.key;

update public.inventory_reservations r
set item_id = i.id
from public.items_catalog i
where r.item_id is null
  and r.resource_type = i.key;

update public.missions ms
set item_id = i.id
from public.items_catalog i
where ms.item_id is null
  and ms.resource_type = i.key;

update public.cases c
set item_id = i.id
from public.items_catalog i
where c.item_id is null
  and c.category = i.key;

update public.public_needs n
set item_id = i.id
from public.items_catalog i
where n.item_id is null
  and n.category = i.key;

-- ============================================================
-- 4) Triggers mínimos: si llega resource_type, completar item_id
-- ============================================================
create or replace function public.trg_fill_item_id_from_resource_type()
returns trigger
language plpgsql
as $$
begin
  if new.item_id is null and new.resource_type is not null then
    select i.id into new.item_id
    from public.items_catalog i
    where i.key = new.resource_type
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_center_resources_fill_item_id on public.center_resources;
create trigger trg_center_resources_fill_item_id
before insert or update on public.center_resources
for each row execute function public.trg_fill_item_id_from_resource_type();

drop trigger if exists trg_inventory_reservations_fill_item_id on public.inventory_reservations;
create trigger trg_inventory_reservations_fill_item_id
before insert or update on public.inventory_reservations
for each row execute function public.trg_fill_item_id_from_resource_type();

drop trigger if exists trg_missions_fill_item_id on public.missions;
create trigger trg_missions_fill_item_id
before insert or update on public.missions
for each row execute function public.trg_fill_item_id_from_resource_type();

