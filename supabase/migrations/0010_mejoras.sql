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
