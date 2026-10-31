-- Cash flow: gasto del mes editado a mano para un mes proyectado. Si no hay
-- fila, el mes usa el promedio de los meses base.

create table fin_projection_living (
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  living numeric(14, 2) not null check (living >= 0),
  updated_at timestamptz not null default now(),
  primary key (couple_id, month)
);

alter table fin_projection_living enable row level security;
create policy fin_projection_living_couple on fin_projection_living for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));
