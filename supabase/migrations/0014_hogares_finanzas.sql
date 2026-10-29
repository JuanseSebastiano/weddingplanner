-- Hogares solo-Finanzas: familiares que usan Finanzas con sus propios datos.
--
-- Cada hogar es una fila más en couples (1 o 2 personas), así el aislamiento
-- por couple_id y RLS ya vale sin cambios. solo_finanzas oculta Boda, Viaje
-- e Inicio en la app.

alter table couples add column solo_finanzas boolean not null default false;

-- Alta desde el SQL Editor, con el usuario ya creado en Authentication:
--   select fin_crear_hogar('mama@mail.com', 'Mamá');
-- Para sumar una segunda persona al mismo hogar:
--   select fin_crear_hogar('papa@mail.com', 'Papá', '<id del hogar>');
create or replace function fin_crear_hogar(p_email text, p_nombre text, p_hogar uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_hogar uuid := p_hogar;
begin
  select id into v_user from auth.users where email = lower(trim(p_email));
  if v_user is null then
    raise exception 'No existe el usuario %: crealo primero en Authentication → Users', p_email;
  end if;

  if v_hogar is null then
    insert into couples (nombre, solo_finanzas) values (p_nombre, true) returning id into v_hogar;
    perform fin_seed_default_categories(v_hogar);
  else
    update couples set nombre = nombre || ' & ' || p_nombre where id = v_hogar;
    if not found then
      raise exception 'No existe el hogar %', v_hogar;
    end if;
  end if;

  insert into couple_members (couple_id, email, nombre, rol, user_id)
  values (v_hogar, lower(trim(p_email)), p_nombre, 'ambos', v_user);

  return v_hogar;
end;
$$;

revoke execute on function fin_crear_hogar(text, text, uuid) from public, anon, authenticated;
