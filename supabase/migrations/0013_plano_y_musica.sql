-- Plano de la carpa ------------------------------------------------------
-- Posición y medidas de cada mesa en metros, desde la esquina superior
-- izquierda de la carpa. x/y null = mesa todavía sin ubicar en el plano.
alter table wedding_tables
  add column forma text not null default 'redonda' check (forma in ('redonda', 'rectangular')),
  add column x numeric(6, 2),
  add column y numeric(6, 2),
  add column ancho numeric(5, 2) not null default 1.6 check (ancho > 0),
  add column largo numeric(5, 2) not null default 1.6 check (largo > 0);

-- Lo que no es mesa: pista, DJ, barra…
create table wedding_layout_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  tipo text not null check (tipo in ('pista', 'dj', 'otro')),
  nombre text not null,
  x numeric(6, 2) not null,
  y numeric(6, 2) not null,
  ancho numeric(5, 2) not null check (ancho > 0),
  largo numeric(5, 2) not null check (largo > 0),
  created_at timestamptz not null default now()
);
create index on wedding_layout_items (couple_id);
alter table wedding_layout_items enable row level security;
create policy wedding_layout_items_couple on wedding_layout_items for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));

-- Música -----------------------------------------------------------------
create table wedding_songs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  momento text not null default 'sin_asignar',
  orden int not null default 0,
  titulo text not null,
  artista text,
  spotify_id text,
  spotify_url text,
  preview_url text,
  portada_url text,
  duracion_ms int,
  notas text,
  created_at timestamptz not null default now(),
  unique (couple_id, spotify_id)
);
create index on wedding_songs (couple_id, momento, orden);
alter table wedding_songs enable row level security;
create policy wedding_songs_couple on wedding_songs for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));
