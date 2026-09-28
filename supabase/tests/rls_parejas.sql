-- Verifica que un usuario de otra pareja no ve ni escribe nada de la nuestra.
-- Corre todo en una transacción y hace rollback: no deja datos.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_parejas.sql
--
-- Falla (raise exception) ante la primera fuga.

begin;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'rls-b@test.local', 'authenticated', 'authenticated');

insert into couples (id, nombre) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pareja A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pareja B');

insert into couple_members (couple_id, email, nombre, rol, user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-a@test.local', 'A', 'novio', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-b@test.local', 'B', 'novio', 'bbbbbbbb-0000-0000-0000-000000000001');

-- Datos de la pareja A en cada tabla con couple_id.
insert into wedding_info (id, couple_id, fecha, lugar)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-01', 'A');

-- Como usuario A: lo inserta usando el default de couple_id.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into wedding_tasks (wedding_id, titulo) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tarea A');
insert into wedding_guests (wedding_id, nombre) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'invitado A');

do $$
begin
  if (select count(*) from wedding_tasks where titulo = 'tarea A') <> 1 then
    raise exception 'A no ve su propia tarea';
  end if;
  if (select couple_id from wedding_tasks where titulo = 'tarea A') <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then
    raise exception 'El default de couple_id no tomó la pareja de A';
  end if;
end $$;

-- Como usuario B: no ve nada de A en ninguna tabla con couple_id.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  t text;
  n int;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'couple_id'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('select count(*) from %I where couple_id <> %L', t,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') into n;
    if n > 0 then
      raise exception 'Fuga: B ve % filas ajenas en %', n, t;
    end if;
  end loop;

  if (select count(*) from couples) <> 1 then
    raise exception 'Fuga: B ve parejas ajenas';
  end if;
  if (select count(*) from couple_members) <> 1 then
    raise exception 'Fuga: B ve miembros ajenos';
  end if;
  if (select count(*) from wedding_members) <> 0 then
    raise exception 'Fuga: B ve wedding_members ajenos';
  end if;

  -- B no puede escribir en la pareja A.
  begin
    insert into wedding_tasks (wedding_id, couple_id, titulo)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'intrusa');
    raise exception 'Fuga: B insertó en la pareja A';
  exception when insufficient_privilege then null;
  end;

  update wedding_tasks set titulo = 'pisada' where titulo = 'tarea A';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'Fuga: B modificó una tarea de A'; end if;
end $$;

-- Anónimo: no ve nada.
reset role;
set local role anon;
do $$
begin
  if (select count(*) from wedding_tasks) > 0 or (select count(*) from wedding_info) > 0 then
    raise exception 'Fuga: anon ve datos';
  end if;
exception when insufficient_privilege then null;
end $$;

reset role;
select 'RLS OK: la pareja B no ve ni modifica datos de A; anon no ve nada' as resultado;

rollback;
