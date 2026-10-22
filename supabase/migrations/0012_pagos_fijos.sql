-- Pagos fijos -------------------------------------------------------------
-- Cuentas que se pagan todos los meses (alquiler, servicios, gimnasio) con
-- su día de vencimiento. Se marcan como pagadas mes a mes en
-- fin_bill_payments; lo impago del mes aparece como recordatorio.
create table fin_bills (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  user_id uuid not null references couple_members (user_id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  amount numeric(14, 2) check (amount > 0),
  currency moneda not null default 'ARS',
  due_day int not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on fin_bills (couple_id);
create trigger fin_bills_set_updated_at
  before update on fin_bills for each row execute function set_updated_at();

create table fin_bill_payments (
  bill_id uuid not null references fin_bills (id) on delete cascade,
  couple_id uuid not null references couples (id) on delete cascade,
  -- Formato YYYY-MM.
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  paid_at timestamptz not null default now(),
  primary key (bill_id, month)
);

alter table fin_bills enable row level security;
create policy fin_bills_couple on fin_bills for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));

alter table fin_bill_payments enable row level security;
create policy fin_bill_payments_couple on fin_bill_payments for all to authenticated
  using (is_couple_member(couple_id)) with check (is_couple_member(couple_id));
