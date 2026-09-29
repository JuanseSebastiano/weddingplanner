-- Mejoras: disponible por persona, cuotas del viaje y calendario de tareas.

-- Disponible por persona ------------------------------------------------
-- fin_card_debt expone el dueño de la tarjeta para poder filtrar la deuda
-- de cada uno (columna nueva al final: create or replace lo permite).
create or replace view fin_card_debt with (security_invoker = true) as
select
  a.couple_id,
  a.id as account_id,
  a.name,
  e.currency,
  fin_card_unpaid_since(current_date, a.closing_day, a.due_day) as unpaid_since,
  coalesce(sum(e.amount), 0)::numeric(14, 2) as debt,
  a.owner_id
from fin_accounts a
join fin_expenses e
  on e.account_id = a.id
  and e.status = 'confirmed'
  and e.expense_date > fin_card_unpaid_since(current_date, a.closing_day, a.due_day)
where a.type = 'credit_card'
group by a.couple_id, a.id, a.name, e.currency, a.closing_day, a.due_day, a.owner_id;

-- Cuotas del viaje -------------------------------------------------------
-- El amount de vuelos, trenes, reservas y crucero es el precio total. Si
-- el ítem tiene cuotas, lo pagado sale de las cuotas pagadas y cada cuota
-- impaga es un vencimiento; si no, sigue valiendo su paid / due_date.
-- Mismas convenciones que el resto de trip_* (0008): id del dispositivo,
-- updated_at de la base como cursor y borrado lógico.

create table trip_payments (
  id uuid primary key,
  couple_id uuid not null default my_couple_id() references couples (id) on delete cascade,
  item_tipo text not null check (item_tipo in ('flight', 'train', 'booking', 'cruise')),
  item_id uuid not null,
  fecha date not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency moneda not null default 'USD',
  fx_rate numeric(14, 4),
  paid boolean not null default false,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index on trip_payments (couple_id, updated_at);
create index on trip_payments (item_id);
create trigger trip_payments_touch before insert or update on trip_payments
  for each row execute function trip_touch();
alter table trip_payments enable row level security;
create policy trip_payments_couple on trip_payments for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));

-- Los ítems con precio del viaje, con su etiqueta y fecha de referencia.
create view trip_items with (security_invoker = true) as
select couple_id, 'flight'::text as tipo, id, 'Vuelo ' || origen || ' → ' || destino as label,
  coalesce(due_date, fecha) as due_date, amount, currency, paid, '/viaje/vuelos'::text as href
from trip_flights where deleted_at is null and amount is not null
union all
select couple_id, 'train', id, 'Tren ' || origen || ' → ' || destino,
  coalesce(due_date, fecha), amount, currency, paid, '/viaje/trenes'
from trip_trains where deleted_at is null and amount is not null
union all
select couple_id, 'booking', id,
  tipo || coalesce(nullif(' ' || nombre, ' '), '') || coalesce(nullif(' · ' || ciudad, ' · '), ''),
  coalesce(due_date, check_in), amount, currency, paid, '/viaje/reservas'
from trip_bookings where deleted_at is null and amount is not null
union all
select couple_id, 'cruise', id, 'Crucero ' || barco,
  coalesce(due_date, embarque_fecha), amount, currency, paid, '/viaje/crucero'
from trip_cruises where deleted_at is null and amount is not null;

create or replace view trip_budget with (security_invoker = true) as
with cuotas as (
  select item_id, count(*) as n, coalesce(sum(amount) filter (where paid), 0) as pagado
  from trip_payments
  where deleted_at is null
  group by item_id
),
items as (
  select i.couple_id, i.currency, i.amount,
    case when c.n is not null then c.pagado when i.paid then i.amount else 0 end as pagado
  from trip_items i
  left join cuotas c on c.item_id = i.id
)
select
  couple_id,
  currency,
  sum(amount)::numeric(14, 2) as total,
  sum(pagado)::numeric(14, 2) as paid,
  (sum(amount) - sum(pagado))::numeric(14, 2) as pending
from items
group by couple_id, currency;

create or replace view fin_commitments with (security_invoker = true) as
select
  p.couple_id,
  'boda'::text as source,
  p.id as ref_id,
  p.fecha as due_date,
  p.monto as amount,
  p.moneda as currency,
  p.cotizacion_usd as fx_rate,
  coalesce(b.concepto, 'Pago de la boda') as label,
  '/boda/pagos'::text as href
from wedding_payments p
left join wedding_budget_items b on b.id = p.budget_item_id
where not p.pagado

union all
-- Ítems del viaje sin cuotas, impagos.
select i.couple_id, 'viaje', i.id, i.due_date, i.amount, i.currency, null, i.label, i.href
from trip_items i
where not i.paid
  and not exists (select 1 from trip_payments t where t.item_id = i.id and t.deleted_at is null)

union all
-- Cuotas impagas del viaje.
select t.couple_id, 'viaje', t.id, t.fecha, t.amount, t.currency, null, i.label || ' · cuota', '/viaje/gastos'
from trip_payments t
join trip_items i on i.id = t.item_id
where t.deleted_at is null and not t.paid

union all
select couple_id, 'tarjeta', account_id, due_date, amount, currency, null,
  'Resumen ' || name, '/finanzas/configuracion'
from fin_card_next_due;
