-- Presupuesto mensual: un tope total por pareja y rubros marcados como
-- variables. Los topes por rubro siguen en fin_budgets y no pueden sumar más
-- que el tope; si un rubro se pasa durante el mes, el exceso se descuenta de
-- los variables.

alter table couples add column fin_tope_mensual numeric(14, 2) check (fin_tope_mensual > 0);

alter table fin_categories add column variable boolean not null default false;

update fin_categories set variable = true
where kind = 'expense' and name in ('Salidas', 'Hogar', 'Comidas semanales', 'Otros');

-- Los hogares nuevos arrancan con Salidas, Hogar y Otros como variables.
create or replace function fin_seed_default_categories(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into fin_categories (couple_id, name, color, icon, is_default, kind, variable)
  values
    (p_couple_id, 'Supermercado', '#2a78d6', 'shopping-cart', true, 'expense', false),
    (p_couple_id, 'Servicios',    '#eb6834', 'zap',           true, 'expense', false),
    (p_couple_id, 'Salidas',      '#1baf7a', 'utensils',      true, 'expense', true),
    (p_couple_id, 'Transporte',   '#eda100', 'car',           true, 'expense', false),
    (p_couple_id, 'Salud',        '#e87ba4', 'heart-pulse',   true, 'expense', false),
    (p_couple_id, 'Hogar',        '#008300', 'house',         true, 'expense', true),
    (p_couple_id, 'Otros',        '#4a3aa7', 'ellipsis',      true, 'expense', true),
    (p_couple_id, 'Sueldo',       '#1baf7a', 'wallet',        true, 'income',  false),
    (p_couple_id, 'Freelance',    '#2a78d6', 'laptop',        true, 'income',  false),
    (p_couple_id, 'Alquiler',     '#eda100', 'key',           true, 'income',  false),
    (p_couple_id, 'Inversiones',  '#4a3aa7', 'trending-up',   true, 'income',  false),
    (p_couple_id, 'Otros',        '#e87ba4', 'ellipsis',      true, 'income',  false)
  on conflict (couple_id, kind, name) do nothing;
end;
$$;

revoke execute on function fin_seed_default_categories(uuid) from public, anon, authenticated;
