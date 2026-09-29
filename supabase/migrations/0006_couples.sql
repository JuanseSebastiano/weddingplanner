-- Pareja como unidad de aislamiento de toda la app (boda, finanzas, viaje).
--
-- La boda existente pasa a ser de la pareja con el mismo id que la boda: así
-- couple_id = wedding_id en todas las filas y los paths de Storage
-- (<wedding_id>/...) siguen siendo válidos como <couple_id>/...
--
-- Las tablas de la boda se renombran con prefijo wedding_ para convivir con
-- fin_* y trip_*. Se revierte el acceso anónimo de 0005: vuelve a hacer falta
-- sesión y ser miembro de la pareja.

create table couples (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  email extensions.citext not null unique,
  nombre text not null,
  rol responsable not null,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on couple_members (couple_id);

insert into couples (id, nombre)
select w.id, coalesce(
  (select string_agg(m.nombre, ' & ' order by m.rol desc)
   from wedding_members m where m.wedding_id = w.id),
  'Pareja')
from weddings w;

insert into couple_members (couple_id, email, nombre, rol, user_id)
select wedding_id, email, nombre, rol, user_id from wedding_members;

create or replace function is_couple_member(c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from couple_members m
    where m.couple_id = c_id and m.user_id = auth.uid()
  );
$$;

create or replace function my_couple_id()
returns uuid
language sql
security definer
stable
set search_path = public, extensions
as $$
  select m.couple_id from couple_members m where m.user_id = auth.uid() limit 1;
$$;

revoke execute on function is_couple_member(uuid) from public, anon;
revoke execute on function my_couple_id() from public, anon;
grant execute on function is_couple_member(uuid) to authenticated;
grant execute on function my_couple_id() to authenticated;

-- Renombres
alter table weddings rename to wedding_info;
alter table tables rename to wedding_tables;
alter table guests rename to wedding_guests;
alter table vendors rename to wedding_vendors;
alter table quotes rename to wedding_quotes;
alter table budget_items rename to wedding_budget_items;
alter table payments rename to wedding_payments;
alter table tasks rename to wedding_tasks;
alter table ideas rename to wedding_ideas;
alter table documents rename to wedding_documents;
alter table timeline_events rename to wedding_timeline_events;

-- couple_id en cada tabla de dominio. El default toma la pareja de la sesión,
-- así los inserts existentes no necesitan mandarlo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_tables', 'wedding_guests', 'wedding_vendors', 'wedding_quotes',
    'wedding_budget_items', 'wedding_payments', 'wedding_tasks',
    'wedding_ideas', 'wedding_documents', 'wedding_timeline_events'
  ] loop
    execute format('alter table %I add column couple_id uuid references couples (id) on delete cascade', t);
    execute format('update %I set couple_id = wedding_id', t);
    execute format('alter table %I alter column couple_id set not null', t);
    execute format('alter table %I alter column couple_id set default my_couple_id()', t);
    execute format('create index on %I (couple_id)', t);
  end loop;
end $$;

alter table wedding_info add column couple_id uuid references couples (id) on delete cascade;
update wedding_info set couple_id = id;
alter table wedding_info alter column couple_id set not null;
alter table wedding_info alter column couple_id set default my_couple_id();
alter table wedding_info add constraint wedding_info_couple_unique unique (couple_id);

-- Policies: se reemplazan las abiertas de 0005.
drop policy weddings_member on wedding_info;
drop policy tables_member on wedding_tables;
drop policy guests_member on wedding_guests;
drop policy vendors_member on wedding_vendors;
drop policy quotes_member on wedding_quotes;
drop policy budget_items_member on wedding_budget_items;
drop policy payments_member on wedding_payments;
drop policy tasks_member on wedding_tasks;
drop policy ideas_member on wedding_ideas;
drop policy documents_member on wedding_documents;
drop policy timeline_events_member on wedding_timeline_events;

do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_info', 'wedding_tables', 'wedding_guests', 'wedding_vendors',
    'wedding_quotes', 'wedding_budget_items', 'wedding_payments',
    'wedding_tasks', 'wedding_ideas', 'wedding_documents',
    'wedding_timeline_events'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (is_couple_member(couple_id)) with check (is_couple_member(couple_id))',
      t || '_couple', t);
  end loop;
end $$;

alter table couples enable row level security;
alter table couple_members enable row level security;

create policy couples_member on couples
  for select to authenticated using (is_couple_member(id));

create policy couple_members_member on couple_members
  for select to authenticated using (is_couple_member(couple_id));

-- wedding_members queda reemplazada por couple_members. No se borra todavía
-- (se decide después de verificar la copia), pero deja de ser pública.
alter policy wedding_members_member on wedding_members
  to authenticated
  using (is_couple_member(wedding_id)) with check (is_couple_member(wedding_id));

-- Storage: el primer segmento del path es el couple_id.
alter policy files_member on storage.objects
  to authenticated
  using (
    bucket_id = 'files'
    and is_couple_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'files'
    and is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- Las funciones de la boda ya no se usan en policies.
drop function if exists is_wedding_member(uuid);
drop function if exists my_wedding_id();
