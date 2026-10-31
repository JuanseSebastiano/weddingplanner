-- Spotify con la cuenta de la pareja.
--
-- Desde febrero de 2026 Spotify no deja leer playlists con client
-- credentials: hace falta el token de un usuario dueño o colaborador de la
-- playlist. Se guarda el refresh token por pareja. Sin policies a propósito:
-- solo lo lee el servidor con service role.

create table wedding_spotify (
  couple_id uuid primary key references couples (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table wedding_spotify enable row level security;
