-- Esquema base de la app de casamiento.
create extension if not exists citext;

create type lado_familia as enum ('novio', 'novia');
create type rsvp_estado as enum ('pendiente', 'confirmado', 'rechazado');
create type menu_tipo as enum ('ninguno', 'vegetariano', 'celiaco', 'otro');
create type rubro as enum (
  'catering', 'fotografia', 'musica', 'salon', 'decoracion',
  'vestimenta', 'transporte', 'civil_iglesia', 'otros'
);
create type vendor_estado as enum (
  'contactado', 'presupuesto_recibido', 'contratado', 'descartado'
);
create type quote_estado as enum ('recibido', 'aceptado', 'rechazado', 'vencido');
create type moneda as enum ('ARS', 'USD');
create type pago_tipo as enum ('sena', 'cuota', 'saldo');
create type tarea_estado as enum ('pendiente', 'en_curso', 'hecha');
create type prioridad as enum ('alta', 'media', 'baja');
create type responsable as enum ('novio', 'novia', 'ambos');
create type idea_estado as enum ('idea', 'evaluando', 'aprobada', 'descartada');

create table weddings (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  lugar text not null,
  presupuesto_objetivo numeric(14, 2) not null default 0,
  moneda_base moneda not null default 'USD',
  -- Cotización de referencia para convertir estimados; los pagos guardan la suya.
  cotizacion_referencia numeric(14, 2) not null default 1000,
  created_at timestamptz not null default now()
);

create table wedding_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  email citext not null unique,
  nombre text not null,
  rol responsable not null,
  user_id uuid references auth.users (id) on delete set null
);

create index on wedding_members (user_id);

create table tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  numero int not null,
  capacidad int not null default 10,
  ubicacion text,
  created_at timestamptz not null default now(),
  unique (wedding_id, numero)
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  nombre text not null,
  grupo text,
  lado lado_familia not null default 'novio',
  email text,
  telefono text,
  rsvp rsvp_estado not null default 'pendiente',
  acompanantes int not null default 0,
  menu menu_tipo not null default 'ninguno',
  menu_detalle text,
  alojamiento boolean not null default false,
  notas text,
  table_id uuid references tables (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on guests (wedding_id);
create index on guests (table_id);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  nombre text not null,
  rubro rubro not null default 'otros',
  contacto text,
  telefono text,
  web_ig text,
  estado vendor_estado not null default 'contactado',
  rating int check (rating between 1 and 5),
  notas text,
  created_at timestamptz not null default now()
);

create index on vendors (wedding_id);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  vendor_id uuid not null references vendors (id) on delete cascade,
  monto numeric(14, 2) not null,
  moneda moneda not null default 'ARS',
  incluye text,
  excluye text,
  valido_hasta date,
  archivo_path text,
  estado quote_estado not null default 'recibido',
  created_at timestamptz not null default now()
);

create index on quotes (wedding_id);
create index on quotes (vendor_id);

create table budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  categoria rubro not null default 'otros',
  concepto text not null,
  monto_estimado numeric(14, 2) not null default 0,
  monto_real numeric(14, 2),
  moneda moneda not null default 'ARS',
  vendor_id uuid references vendors (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on budget_items (wedding_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  budget_item_id uuid not null references budget_items (id) on delete cascade,
  monto numeric(14, 2) not null,
  moneda moneda not null default 'ARS',
  -- Cotización ARS por 1 USD usada en ese pago. Obligatoria si el pago es en USD.
  cotizacion_usd numeric(14, 2),
  fecha date not null default current_date,
  medio_pago text,
  tipo pago_tipo not null default 'cuota',
  comprobante_path text,
  pagado boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cotizacion_obligatoria_en_usd check (
    moneda = 'ARS' or cotizacion_usd is not null
  )
);

create index on payments (wedding_id);
create index on payments (budget_item_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria rubro not null default 'otros',
  responsable responsable not null default 'ambos',
  fecha_limite date,
  prioridad prioridad not null default 'media',
  estado tarea_estado not null default 'pendiente',
  depende_de uuid references tasks (id) on delete set null,
  vendor_id uuid references vendors (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on tasks (wedding_id);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria rubro not null default 'otros',
  links text[] not null default '{}',
  estado idea_estado not null default 'idea',
  created_at timestamptz not null default now()
);

create index on ideas (wedding_id);

-- Archivos en Storage, vinculables a cualquier entidad por (entidad, entidad_id).
create table documents (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  entidad text not null,
  entidad_id uuid,
  nombre text not null,
  path text not null,
  mime text,
  created_at timestamptz not null default now()
);

create index on documents (wedding_id);
create index on documents (entidad, entidad_id);

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  hora time not null,
  actividad text not null,
  responsable text,
  notas text,
  created_at timestamptz not null default now()
);

create index on timeline_events (wedding_id);
