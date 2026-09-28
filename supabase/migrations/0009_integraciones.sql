-- Integraciones entre módulos. Solo vistas: los datos siguen viviendo en su
-- tabla de origen, nada se duplica. security_invoker hace que apliquen las
-- policies de RLS de cada tabla.
--
-- fx_rate en estas vistas es siempre "pesos por dólar" cuando se conoce
-- (la cotización del pago de la boda); si es null se usa la cotización de
-- referencia de la boda.

-- Presupuesto del viaje por moneda: lo que tiene precio en vuelos, trenes,
-- reservas y crucero.
create view trip_budget with (security_invoker = true) as
with items as (
  select couple_id, amount, currency, paid from trip_flights where deleted_at is null and amount is not null
  union all
  select couple_id, amount, currency, paid from trip_trains where deleted_at is null and amount is not null
  union all
  select couple_id, amount, currency, paid from trip_bookings where deleted_at is null and amount is not null
  union all
  select couple_id, amount, currency, paid from trip_cruises where deleted_at is null and amount is not null
)
select
  couple_id,
  currency,
  sum(amount)::numeric(14, 2) as total,
  (coalesce(sum(amount) filter (where paid), 0))::numeric(14, 2) as paid,
  (coalesce(sum(amount) filter (where not paid), 0))::numeric(14, 2) as pending
from items
group by couple_id, currency;

-- Resúmenes de tarjeta por pagar: el del último cierre si todavía no
-- venció, y el ciclo en curso (lo gastado desde el último cierre, que vence
-- después del próximo). Juntos suman la deuda de fin_card_debt.
create view fin_card_next_due with (security_invoker = true) as
with cards as (
  select
    a.couple_id,
    a.id as account_id,
    a.name,
    a.closing_day,
    a.due_day,
    fin_last_closing(current_date, a.closing_day) as last_closing
  from fin_accounts a
  where a.type = 'credit_card' and a.active and a.closing_day is not null and a.due_day is not null
),
periods as (
  -- Resumen cerrado e impago.
  select couple_id, account_id, name, due_day,
    fin_last_closing((last_closing - interval '1 day')::date, closing_day) as desde,
    last_closing as hasta
  from cards
  where current_date < fin_due_after(last_closing, due_day)
  union all
  -- Ciclo en curso.
  select couple_id, account_id, name, due_day,
    last_closing as desde,
    fin_day_in_month((last_closing + interval '1 month')::date, closing_day) as hasta
  from cards
)
select
  p.couple_id,
  p.account_id,
  p.name,
  e.currency,
  fin_due_after(p.hasta, p.due_day) as due_date,
  sum(e.amount)::numeric(14, 2) as amount
from periods p
join fin_expenses e
  on e.account_id = p.account_id
  and e.status = 'confirmed'
  and e.expense_date > p.desde
  and e.expense_date <= p.hasta
group by p.couple_id, p.account_id, p.name, e.currency, p.hasta, p.due_day;

-- Compromisos futuros de la pareja: pagos pendientes de la boda, lo que
-- falta pagar del viaje y el próximo resumen de cada tarjeta.
create view fin_commitments with (security_invoker = true) as
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
select couple_id, 'viaje', id, coalesce(due_date, fecha), amount, currency, null,
  'Vuelo ' || origen || ' → ' || destino, '/viaje/vuelos'
from trip_flights where deleted_at is null and amount is not null and not paid

union all
select couple_id, 'viaje', id, coalesce(due_date, fecha), amount, currency, null,
  'Tren ' || origen || ' → ' || destino, '/viaje/trenes'
from trip_trains where deleted_at is null and amount is not null and not paid

union all
select couple_id, 'viaje', id, coalesce(due_date, check_in), amount, currency, null,
  tipo || coalesce(nullif(' ' || nombre, ' '), '') || coalesce(nullif(' · ' || ciudad, ' · '), ''),
  '/viaje/reservas'
from trip_bookings where deleted_at is null and amount is not null and not paid

union all
select couple_id, 'viaje', id, coalesce(due_date, embarque_fecha), amount, currency, null,
  'Crucero ' || barco, '/viaje/crucero'
from trip_cruises where deleted_at is null and amount is not null and not paid

union all
select couple_id, 'tarjeta', account_id, due_date, amount, currency, null,
  'Resumen ' || name, '/finanzas/configuracion'
from fin_card_next_due;
