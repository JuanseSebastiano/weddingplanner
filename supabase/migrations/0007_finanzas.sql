-- Finanzas: esquema de nuestrasfinanzas (0001–0008) portado con prefijo fin_.
--
-- Cambios respecto del original:
-- - household_id -> couple_id (couples). No hay households ni profiles: el
--   nombre visible sale de couple_members.nombre y los user_id apuntan a
--   couple_members(user_id), lo que además permite el embed `profile:` de
--   PostgREST que usa la API.
-- - currency pasa a ser el enum moneda (ARS|USD) + fx_rate opcional.
-- - fin_accounts suma saldo manual, moneda del saldo y día de cierre y de
--   vencimiento de tarjeta, para calcular el disponible real.
-- - RLS por pareja (lectura y escritura para los dos miembros).
--   fin_gmail_credentials sigue sin policies: solo el backend la lee.

create extension if not exists pg_trgm with schema extensions;

do $$ begin
  create type account_type as enum ('credit_card', 'debit_card', 'bank_account', 'cash', 'other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type expense_source as enum ('manual', 'email');
exception when duplicate_object then null; end $$;
do $$ begin
  create type expense_status as enum ('pending', 'confirmed', 'discarded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type parse_status as enum ('parsed', 'failed', 'duplicate', 'ignored');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rule_match_field as enum ('merchant', 'sender', 'description');
exception when duplicate_object then null; end $$;
do $$ begin
  create type rule_match_type as enum ('contains', 'equals', 'regex');
exception when duplicate_object then null; end $$;
do $$ begin
  create type category_kind as enum ('expense', 'income');
exception when duplicate_object then null; end $$;

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Cuentas ---------------------------------------------------------------

create table fin_accounts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  owner_id uuid not null references couple_members (user_id) on delete cascade,
  name text not null,
  type account_type not null default 'credit_card',
  bank_name text,
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  active boolean not null default true,
  -- Disponible real: saldo cargado a mano en cuentas líquidas.
  balance numeric(14, 2),
  balance_currency moneda not null default 'ARS',
  balance_updated_at timestamptz,
  -- Tarjetas: día de cierre y de vencimiento del resumen.
  closing_day int check (closing_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on fin_accounts (couple_id);
create index on fin_accounts (owner_id);
create index on fin_accounts (couple_id, last4) where last4 is not null;
create trigger fin_accounts_set_updated_at
  before update on fin_accounts for each row execute function set_updated_at();

-- Rubros ----------------------------------------------------------------

create table fin_categories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  icon text,
  is_default boolean not null default false,
  kind category_kind not null default 'expense',
  created_at timestamptz not null default now(),
  unique (couple_id, kind, name)
);

create index on fin_categories (couple_id, kind);

-- Ingesta de mails ------------------------------------------------------

create table fin_email_ingestion_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references couple_members (user_id) on delete cascade,
  couple_id uuid not null references couples (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_address text,
  subject text,
  received_at timestamptz,
  raw_snippet text,
  parser_id text,
  parse_status parse_status not null default 'failed',
  parsed_amount numeric(14, 2),
  parsed_currency text,
  parsed_merchant text,
  parsed_date date,
  matched_account_id uuid references fin_accounts (id) on delete set null,
  expense_id uuid,
  error_detail text,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index on fin_email_ingestion_log (couple_id, created_at desc);
create index on fin_email_ingestion_log (parse_status);

-- Gastos ----------------------------------------------------------------

create table fin_expenses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  account_id uuid references fin_accounts (id) on delete set null,
  category_id uuid references fin_categories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency moneda not null default 'ARS',
  fx_rate numeric(14, 4),
  merchant text,
  description text,
  expense_date date not null default current_date,
  source expense_source not null default 'manual',
  status expense_status not null default 'confirmed',
  email_ingestion_id uuid references fin_email_ingestion_log (id) on delete set null,
  applied_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El estado pendiente es exclusivo de la ingesta automática: nada se
  -- imputa desde un mail sin que alguien lo confirme.
  constraint fin_expenses_manual_not_pending check (source = 'email' or status <> 'pending')
);

create index on fin_expenses (couple_id, expense_date desc);
create index on fin_expenses (user_id);
create index on fin_expenses (category_id);
create index on fin_expenses (account_id);
create index on fin_expenses (couple_id, created_at desc) where status = 'pending';
create index on fin_expenses using gin (merchant extensions.gin_trgm_ops);
create index on fin_expenses using gin (description extensions.gin_trgm_ops);
create trigger fin_expenses_set_updated_at
  before update on fin_expenses for each row execute function set_updated_at();

alter table fin_email_ingestion_log
  add constraint fin_email_ingestion_log_expense_id_fkey
  foreign key (expense_id) references fin_expenses (id) on delete set null;

-- Reglas ----------------------------------------------------------------

create table fin_categorization_rules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  match_field rule_match_field not null default 'merchant',
  match_type rule_match_type not null default 'contains',
  pattern text not null check (length(trim(pattern)) > 0),
  category_id uuid not null references fin_categories (id) on delete cascade,
  account_id uuid references fin_accounts (id) on delete set null,
  active boolean not null default true,
  created_by uuid references couple_members (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on fin_categorization_rules (couple_id, priority) where active;
create trigger fin_categorization_rules_set_updated_at
  before update on fin_categorization_rules for each row execute function set_updated_at();

alter table fin_expenses
  add constraint fin_expenses_applied_rule_id_fkey
  foreign key (applied_rule_id) references fin_categorization_rules (id) on delete set null;

-- Gmail -----------------------------------------------------------------

create table fin_gmail_credentials (
  user_id uuid primary key references couple_members (user_id) on delete cascade,
  gmail_address text not null,
  refresh_token_enc text not null,
  history_id text,
  last_synced_at timestamptz,
  watch_expiration timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fin_gmail_credentials_set_updated_at
  before update on fin_gmail_credentials for each row execute function set_updated_at();

-- Ingresos --------------------------------------------------------------

create table fin_incomes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  account_id uuid references fin_accounts (id) on delete set null,
  category_id uuid references fin_categories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency moneda not null default 'ARS',
  fx_rate numeric(14, 4),
  payer text,
  description text,
  income_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on fin_incomes (couple_id, income_date desc);
create index on fin_incomes (user_id);
create index on fin_incomes (category_id);
create index on fin_incomes (account_id);
create index on fin_incomes using gin (payer extensions.gin_trgm_ops);
create index on fin_incomes using gin (description extensions.gin_trgm_ops);
create trigger fin_incomes_set_updated_at
  before update on fin_incomes for each row execute function set_updated_at();

-- Tenencias -------------------------------------------------------------

create table fin_holdings (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  ticker text not null check (ticker = upper(btrim(ticker)) and length(ticker) > 0),
  quantity numeric(18, 6) not null check (quantity > 0),
  avg_cost numeric(14, 2) not null check (avg_cost > 0),
  broker text not null default 'Balanz',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index on fin_holdings (couple_id);
create index on fin_holdings (user_id);
create trigger fin_holdings_set_updated_at
  before update on fin_holdings for each row execute function set_updated_at();

-- Presupuestos por rubro ------------------------------------------------

create table fin_budgets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  category_id uuid not null references fin_categories (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  created_by uuid not null references couple_members (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, category_id)
);

create index on fin_budgets (couple_id);
create trigger fin_budgets_set_updated_at
  before update on fin_budgets for each row execute function set_updated_at();

-- Caja de ahorro --------------------------------------------------------

create table fin_savings_movements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdrawal', 'investment')),
  amount numeric(14, 2) not null check (amount > 0),
  moved_at date not null,
  account_id uuid references fin_accounts (id) on delete set null,
  holding_id uuid references fin_holdings (id) on delete cascade,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_savings_movements_holding_matches_kind check (
    (kind = 'investment' and holding_id is not null)
    or (kind <> 'investment' and holding_id is null)
  )
);

create index on fin_savings_movements (couple_id, moved_at desc);
create index on fin_savings_movements (holding_id);
create trigger fin_savings_movements_set_updated_at
  before update on fin_savings_movements for each row execute function set_updated_at();

-- RLS -------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_accounts', 'fin_categories', 'fin_email_ingestion_log', 'fin_expenses',
    'fin_categorization_rules', 'fin_incomes', 'fin_holdings', 'fin_budgets',
    'fin_savings_movements'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (is_couple_member(couple_id)) with check (is_couple_member(couple_id))',
      t || '_couple', t);
  end loop;
end $$;

-- Sin policies a propósito: el refresh token cifrado solo lo lee el backend.
alter table fin_gmail_credentials enable row level security;

-- Rubros por defecto ----------------------------------------------------

create or replace function fin_seed_default_categories(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into fin_categories (couple_id, name, color, icon, is_default, kind)
  values
    (p_couple_id, 'Supermercado', '#2a78d6', 'shopping-cart', true, 'expense'),
    (p_couple_id, 'Servicios',    '#eb6834', 'zap',           true, 'expense'),
    (p_couple_id, 'Salidas',      '#1baf7a', 'utensils',      true, 'expense'),
    (p_couple_id, 'Transporte',   '#eda100', 'car',           true, 'expense'),
    (p_couple_id, 'Salud',        '#e87ba4', 'heart-pulse',   true, 'expense'),
    (p_couple_id, 'Hogar',        '#008300', 'house',         true, 'expense'),
    (p_couple_id, 'Otros',        '#4a3aa7', 'ellipsis',      true, 'expense'),
    (p_couple_id, 'Sueldo',       '#1baf7a', 'wallet',        true, 'income'),
    (p_couple_id, 'Freelance',    '#2a78d6', 'laptop',        true, 'income'),
    (p_couple_id, 'Alquiler',     '#eda100', 'key',           true, 'income'),
    (p_couple_id, 'Inversiones',  '#4a3aa7', 'trending-up',   true, 'income'),
    (p_couple_id, 'Otros',        '#e87ba4', 'ellipsis',      true, 'income')
  on conflict (couple_id, kind, name) do nothing;
end;
$$;

revoke execute on function fin_seed_default_categories(uuid) from public, anon, authenticated;

do $$
declare
  c record;
begin
  for c in select id from couples loop
    perform fin_seed_default_categories(c.id);
  end loop;
end $$;

-- Disponible real -------------------------------------------------------
--
-- Líquido = suma de saldos cargados en cuentas que no son tarjeta de crédito.
-- Deuda de tarjeta = gastos confirmados de cada tarjeta que todavía no se
-- pagaron: si el resumen del último cierre ya venció, lo posterior a ese
-- cierre; si todavía no venció, lo posterior al cierre anterior (ese
-- resumen está pendiente de pago más lo que va del ciclo actual).
-- Una tarjeta sin día de cierre cuenta lo del mes calendario en curso.
-- Disponible real = líquido − deuda, por moneda (no se convierte).

-- Fecha del día `d` en el mes de `m`, recortado al largo del mes.
create or replace function fin_day_in_month(m date, d int)
returns date
language sql
immutable
as $$
  select date_trunc('month', m)::date
    + (least(d, extract(day from (date_trunc('month', m) + interval '1 month - 1 day'))::int) - 1);
$$;

-- Último cierre a la fecha `hoy`.
create or replace function fin_last_closing(hoy date, closing_day int)
returns date
language sql
immutable
as $$
  select case
    when hoy >= fin_day_in_month(hoy, closing_day) then fin_day_in_month(hoy, closing_day)
    else fin_day_in_month((hoy - interval '1 month')::date, closing_day)
  end;
$$;

-- Vencimiento del resumen que cerró en `cierre`: el primer día `due_day`
-- posterior al cierre.
create or replace function fin_due_after(cierre date, due_day int)
returns date
language sql
immutable
as $$
  select case
    when fin_day_in_month(cierre, due_day) > cierre then fin_day_in_month(cierre, due_day)
    else fin_day_in_month((cierre + interval '1 month')::date, due_day)
  end;
$$;

-- Desde qué fecha (exclusive) los gastos de la tarjeta siguen impagos.
create or replace function fin_card_unpaid_since(hoy date, closing_day int, due_day int)
returns date
language sql
immutable
as $$
  select case
    when closing_day is null then (date_trunc('month', hoy) - interval '1 day')::date
    when due_day is null or hoy >= fin_due_after(fin_last_closing(hoy, closing_day), due_day)
      then fin_last_closing(hoy, closing_day)
    else fin_last_closing((fin_last_closing(hoy, closing_day) - interval '1 day')::date, closing_day)
  end;
$$;

create view fin_card_debt with (security_invoker = true) as
select
  a.couple_id,
  a.id as account_id,
  a.name,
  e.currency,
  fin_card_unpaid_since(current_date, a.closing_day, a.due_day) as unpaid_since,
  coalesce(sum(e.amount), 0)::numeric(14, 2) as debt
from fin_accounts a
join fin_expenses e
  on e.account_id = a.id
  and e.status = 'confirmed'
  and e.expense_date > fin_card_unpaid_since(current_date, a.closing_day, a.due_day)
where a.type = 'credit_card'
group by a.couple_id, a.id, a.name, e.currency, a.closing_day, a.due_day;

create view fin_available_now with (security_invoker = true) as
with liquid as (
  select couple_id, balance_currency as currency, sum(balance) as liquid
  from fin_accounts
  where type <> 'credit_card' and active and balance is not null
  group by couple_id, balance_currency
),
debt as (
  select couple_id, currency, sum(debt) as card_debt
  from fin_card_debt
  group by couple_id, currency
)
select
  coalesce(l.couple_id, d.couple_id) as couple_id,
  coalesce(l.currency, d.currency) as currency,
  coalesce(l.liquid, 0)::numeric(14, 2) as liquid,
  coalesce(d.card_debt, 0)::numeric(14, 2) as card_debt,
  (coalesce(l.liquid, 0) - coalesce(d.card_debt, 0))::numeric(14, 2) as available
from liquid l
full join debt d on d.couple_id = l.couple_id and d.currency = l.currency;
