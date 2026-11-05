-- Presupuesto mensual por persona: cada integrante tiene su tope y sus topes
-- por rubro; el de la pareja es la suma. Lo existente queda de quien lo creó.

alter table couple_members add column fin_tope_mensual numeric(14, 2) check (fin_tope_mensual > 0);

update couple_members m
set fin_tope_mensual = c.fin_tope_mensual
from couples c
where c.id = m.couple_id
  and c.fin_tope_mensual is not null
  and m.user_id = coalesce(
    (select b.created_by from fin_budgets b where b.couple_id = c.id limit 1),
    (select m2.user_id from couple_members m2 where m2.couple_id = c.id and m2.user_id is not null order by m2.created_at limit 1)
  );

alter table couples drop column fin_tope_mensual;

alter table fin_budgets add column user_id uuid references couple_members (user_id) on delete cascade;
update fin_budgets set user_id = created_by;
alter table fin_budgets alter column user_id set not null;
alter table fin_budgets drop constraint fin_budgets_couple_id_category_id_key;
alter table fin_budgets add constraint fin_budgets_couple_category_user_key unique (couple_id, category_id, user_id);

-- Resúmenes de tarjeta leídos del mail: totales en pesos y en dólares.

create table fin_card_statements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  gmail_message_id text not null,
  card text not null,
  due_date date,
  total_ars numeric(14, 2),
  total_usd numeric(14, 2),
  min_payment numeric(14, 2),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index on fin_card_statements (couple_id, received_at desc);

alter table fin_card_statements enable row level security;
create policy fin_card_statements_couple on fin_card_statements for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));
