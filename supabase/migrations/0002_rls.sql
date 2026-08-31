-- RLS: sólo los miembros del wedding ven y editan sus filas.

-- security definer para poder leer wedding_members sin recursión de policies.
create or replace function is_wedding_member(w_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from wedding_members m
    where m.wedding_id = w_id
      and (m.user_id = auth.uid() or m.email = (auth.jwt() ->> 'email')::citext)
  );
$$;

create or replace function my_wedding_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.wedding_id from wedding_members m
  where m.user_id = auth.uid() or m.email = (auth.jwt() ->> 'email')::citext
  limit 1;
$$;

-- Al loguearse por primera vez, enlaza el usuario de auth con su fila de miembro.
create or replace function link_member_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update wedding_members
  set user_id = new.id
  where email = new.email::citext and user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function link_member_on_signup();

alter table weddings enable row level security;
alter table wedding_members enable row level security;
alter table guests enable row level security;
alter table tables enable row level security;
alter table vendors enable row level security;
alter table quotes enable row level security;
alter table budget_items enable row level security;
alter table payments enable row level security;
alter table tasks enable row level security;
alter table ideas enable row level security;
alter table documents enable row level security;
alter table timeline_events enable row level security;

create policy weddings_member on weddings
  for all to authenticated
  using (is_wedding_member(id)) with check (is_wedding_member(id));

create policy wedding_members_member on wedding_members
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy guests_member on guests
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy tables_member on tables
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy vendors_member on vendors
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy quotes_member on quotes
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy budget_items_member on budget_items
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy payments_member on payments
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy tasks_member on tasks
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy ideas_member on ideas
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy documents_member on documents
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

create policy timeline_events_member on timeline_events
  for all to authenticated
  using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));

-- Storage privado. Los archivos van bajo el prefijo {wedding_id}/...
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

create policy files_member on storage.objects
  for all to authenticated
  using (
    bucket_id = 'files'
    and is_wedding_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'files'
    and is_wedding_member(((storage.foldername(name))[1])::uuid)
  );

-- Permite chequear si un email está habilitado antes de mandar el magic link,
-- sin exponer la tabla al público.
create or replace function email_habilitado(e text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from wedding_members m where m.email = e::citext);
$$;

grant execute on function email_habilitado(text) to anon, authenticated;
