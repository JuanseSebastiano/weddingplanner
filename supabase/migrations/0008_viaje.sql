-- Viaje: modelo de lunademiel (Dexie) llevado a Supabase con prefijo trip_.
--
-- - id uuid generado en el dispositivo: la app funciona offline y crea filas
--   antes de poder hablar con la base.
-- - updated_at lo pone la base (trigger) y es el cursor del pull; deleted_at
--   es un borrado lógico para que los otros dispositivos se enteren.
-- - Lo que tiene precio (vuelos, trenes, reservas, crucero) lleva amount,
--   currency (ARS|USD), fx_rate, paid y due_date: es lo que después se
--   refleja en Finanzas. Los montos en EUR se convierten a USD al guardar.

create table trip_trips (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  nombre text not null,
  inicio date,
  fin date,
  viajeros text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table trip_stops (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  ciudad text not null,
  region text not null default '',
  pais text not null default '',
  desde date,
  hasta date,
  hotel text not null default '',
  transporte_llegada text not null default '',
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table trip_flights (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  origen text not null,
  destino text not null,
  fecha date,
  hora_salida text not null default '',
  hora_llegada text not null default '',
  vuelo text not null default '',
  aerolinea text not null default '',
  referencia text not null default '',
  clase text not null default '',
  pasajeros text not null default '',
  equipaje text not null default '',
  notas text not null default '',
  amount numeric(14, 2),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  paid boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table trip_trains (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  origen text not null,
  destino text not null,
  fecha date,
  hora text not null default '',
  estacion text not null default '',
  boleto text not null default '',
  notas text not null default '',
  amount numeric(14, 2),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  paid boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Hoteles, autos, atracciones, restaurantes, tours (ex "hotels" de Dexie).
create table trip_bookings (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  tipo text not null default 'Hotel'
    check (tipo in ('Hotel', 'Auto', 'Atracción', 'Restaurante', 'Tour', 'Otro')),
  ciudad text not null default '',
  nombre text not null default '',
  direccion text not null default '',
  check_in date,
  check_out date,
  reserva text not null default '',
  confirmado boolean not null default false,
  notas text not null default '',
  amount numeric(14, 2),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  paid boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table trip_cruises (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  barco text not null default '',
  embarque_puerto text not null default '',
  embarque_fecha date,
  noches int not null default 7,
  escalas text[] not null default '{}',
  cabina_tipo text not null default '',
  cabina_numero text not null default '',
  puente text not null default '',
  huespedes text not null default '',
  tarifa_por_persona text not null default '',
  notas text not null default '',
  amount numeric(14, 2),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  paid boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Gastos durante el viaje.
create table trip_expenses (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  fecha date not null,
  concepto text not null,
  categoria text not null default 'Otros'
    check (categoria in ('Comida', 'Transporte', 'Alojamiento', 'Actividades', 'Compras', 'Otros')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at siempre de la base: es el cursor del pull, no puede depender
-- del reloj de cada teléfono.
create or replace function trip_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'trip_trips', 'trip_stops', 'trip_flights', 'trip_trains',
    'trip_bookings', 'trip_cruises', 'trip_expenses'
  ] loop
    execute format('create index on %I (couple_id, updated_at)', t);
    execute format(
      'create trigger %I before insert or update on %I for each row execute function trip_touch()',
      t || '_touch', t);
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (is_couple_member(couple_id)) with check (is_couple_member(couple_id))',
      t || '_couple', t);
  end loop;
end $$;
