#!/usr/bin/env node
/**
 * Copia los datos de Nuestras Finanzas (proyecto Supabase viejo) a las
 * tablas fin_* del proyecto nuevo, asignando nuestro couple_id.
 *
 * Por defecto corre en DRY-RUN: lee todo, valida y muestra el conteo de
 * filas por tabla y los problemas, sin escribir nada. Con --apply escribe.
 *
 *   OLD_SUPABASE_URL=...  OLD_SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEW_SUPABASE_URL=...  NEW_SUPABASE_SERVICE_ROLE_KEY=... \
 *   COUPLE_ID=11111111-1111-1111-1111-111111111111 \
 *   node scripts/migrar-finanzas.mjs [--apply]
 *
 * - Los usuarios se emparejan por email: el usuario viejo pasa a ser el
 *   couple_member con el mismo email en el proyecto nuevo.
 * - Los ids se conservan, así las relaciones quedan intactas y correrlo dos
 *   veces no duplica nada (las filas que ya están se saltean).
 * - Los rubros que ya existen en el proyecto nuevo (mismo tipo y nombre)
 *   se reutilizan y se remapean sus referencias.
 * - fin_gmail_credentials se copia cifrado: el proyecto nuevo tiene que usar
 *   el mismo GMAIL_TOKEN_ENCRYPTION_KEY que el viejo.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Falta la variable ${name}`);
    process.exit(1);
  }
  return value;
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(env('OLD_SUPABASE_URL'), env('OLD_SUPABASE_SERVICE_ROLE_KEY'), opts);
const newDb = createClient(env('NEW_SUPABASE_URL'), env('NEW_SUPABASE_SERVICE_ROLE_KEY'), opts);
const COUPLE_ID = env('COUPLE_ID');

/** Lee una tabla completa, de a 1000 filas. */
async function readAll(db, table, columns = '*') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) {
      // Una tabla que el proyecto viejo no tiene (migración sin correr) se trata como vacía.
      if (error.code === '42P01' || error.code === 'PGRST205') return rows;
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function listUsers(db) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

const problems = [];
const plan = []; // { table, rows, existing }

// ---- Usuarios -------------------------------------------------------------

const [oldUsers, members] = await Promise.all([
  listUsers(oldDb),
  readAll(newDb, 'couple_members', 'user_id, email, couple_id'),
]);
const memberByEmail = new Map(
  members.filter((m) => m.couple_id === COUPLE_ID && m.user_id).map((m) => [m.email.toLowerCase(), m.user_id]),
);
const userMap = new Map();
for (const u of oldUsers) {
  const target = u.email && memberByEmail.get(u.email.toLowerCase());
  if (target) userMap.set(u.id, target);
}
const mapUser = (id, table) => {
  if (id === null || id === undefined) return null;
  const mapped = userMap.get(id);
  if (!mapped) problems.push(`${table}: usuario ${id} sin miembro con el mismo email en la pareja`);
  return mapped ?? null;
};

// ---- Lectura del proyecto viejo --------------------------------------------

const old = {};
for (const table of [
  'accounts', 'categories', 'categorization_rules', 'email_ingestion_log', 'expenses',
  'incomes', 'holdings', 'budgets', 'savings_movements', 'gmail_credentials',
]) {
  old[table] = await readAll(oldDb, table);
}

// ---- Rubros: reutilizar los que ya existen ---------------------------------

const newCategories = await readAll(newDb, 'fin_categories', 'id, kind, name, couple_id');
const existingCat = new Map(
  newCategories.filter((c) => c.couple_id === COUPLE_ID).map((c) => [`${c.kind}:${c.name}`, c.id]),
);
const catMap = new Map();
const categoriesToInsert = [];
for (const c of old.categories) {
  const kind = c.kind ?? 'expense';
  const existing = existingCat.get(`${kind}:${c.name}`);
  if (existing) catMap.set(c.id, existing);
  else {
    catMap.set(c.id, c.id);
    categoriesToInsert.push({ id: c.id, couple_id: COUPLE_ID, name: c.name, color: c.color, icon: c.icon, is_default: c.is_default, kind, created_at: c.created_at });
  }
}
const mapCat = (id) => (id ? (catMap.get(id) ?? null) : null);

const currency = (value, table, id) => {
  const c = (value ?? 'ARS').toUpperCase();
  if (c !== 'ARS' && c !== 'USD') problems.push(`${table} ${id}: moneda ${value} no es ARS ni USD`);
  return c;
};

// ---- Transformación ----------------------------------------------------------

const t = {};
t.fin_accounts = old.accounts.map((a) => ({
  id: a.id, couple_id: COUPLE_ID, owner_id: mapUser(a.owner_id, 'accounts'), name: a.name, type: a.type,
  bank_name: a.bank_name, last4: a.last4, active: a.active, created_at: a.created_at,
}));
t.fin_categories = categoriesToInsert;
t.fin_categorization_rules = old.categorization_rules.map((r) => ({
  id: r.id, couple_id: COUPLE_ID, name: r.name, priority: r.priority, match_field: r.match_field,
  match_type: r.match_type, pattern: r.pattern, category_id: mapCat(r.category_id), account_id: r.account_id,
  active: r.active, created_by: r.created_by ? mapUser(r.created_by, 'categorization_rules') : null, created_at: r.created_at,
}));
// El log se inserta sin expense_id (el gasto todavía no existe) y se completa después.
t.fin_email_ingestion_log = old.email_ingestion_log.map((l) => ({
  id: l.id, user_id: mapUser(l.user_id, 'email_ingestion_log'), couple_id: COUPLE_ID,
  gmail_message_id: l.gmail_message_id, gmail_thread_id: l.gmail_thread_id, from_address: l.from_address,
  subject: l.subject, received_at: l.received_at, raw_snippet: l.raw_snippet, parser_id: l.parser_id,
  parse_status: l.parse_status, parsed_amount: l.parsed_amount, parsed_currency: l.parsed_currency,
  parsed_merchant: l.parsed_merchant, parsed_date: l.parsed_date, matched_account_id: l.matched_account_id,
  expense_id: null, error_detail: l.error_detail, created_at: l.created_at,
}));
t.fin_expenses = old.expenses.map((e) => ({
  id: e.id, couple_id: COUPLE_ID, user_id: mapUser(e.user_id, 'expenses'), account_id: e.account_id,
  category_id: mapCat(e.category_id), amount: e.amount, currency: currency(e.currency, 'expenses', e.id),
  merchant: e.merchant, description: e.description, expense_date: e.expense_date, source: e.source,
  status: e.status, email_ingestion_id: e.email_ingestion_id, applied_rule_id: e.applied_rule_id, created_at: e.created_at,
}));
t.fin_incomes = old.incomes.map((i) => ({
  id: i.id, couple_id: COUPLE_ID, user_id: mapUser(i.user_id, 'incomes'), account_id: i.account_id,
  category_id: mapCat(i.category_id), amount: i.amount, currency: currency(i.currency, 'incomes', i.id),
  payer: i.payer, description: i.description, income_date: i.income_date, created_at: i.created_at,
}));
t.fin_holdings = old.holdings.map((h) => ({
  id: h.id, couple_id: COUPLE_ID, user_id: mapUser(h.user_id, 'holdings'), ticker: h.ticker, quantity: h.quantity,
  avg_cost: h.avg_cost, broker: h.broker, notes: h.notes, created_at: h.created_at,
}));
t.fin_budgets = old.budgets.map((b) => ({
  id: b.id, couple_id: COUPLE_ID, category_id: mapCat(b.category_id), amount: b.amount,
  created_by: mapUser(b.created_by, 'budgets'), created_at: b.created_at,
}));
t.fin_savings_movements = old.savings_movements.map((s) => ({
  id: s.id, couple_id: COUPLE_ID, user_id: mapUser(s.user_id, 'savings_movements'), kind: s.kind, amount: s.amount,
  moved_at: s.moved_at, account_id: s.account_id, holding_id: s.holding_id, description: s.description, created_at: s.created_at,
}));
t.fin_gmail_credentials = old.gmail_credentials.map((g) => ({
  user_id: mapUser(g.user_id, 'gmail_credentials'), gmail_address: g.gmail_address, refresh_token_enc: g.refresh_token_enc,
  history_id: g.history_id, last_synced_at: g.last_synced_at, created_at: g.created_at,
}));

// ---- Plan: qué ya está en el proyecto nuevo --------------------------------

const ORDER = [
  'fin_accounts', 'fin_categories', 'fin_categorization_rules', 'fin_email_ingestion_log', 'fin_expenses',
  'fin_incomes', 'fin_holdings', 'fin_budgets', 'fin_savings_movements', 'fin_gmail_credentials',
];
for (const table of ORDER) {
  const key = table === 'fin_gmail_credentials' ? 'user_id' : 'id';
  const present = new Set((await readAll(newDb, table, key)).map((r) => r[key]));
  const pending = t[table].filter((r) => !present.has(r[key]));
  plan.push({ table, source: t[table].length, existing: t[table].length - pending.length, rows: pending });
}

console.log(`\n${APPLY ? 'APLICANDO' : 'DRY-RUN (no se escribe nada; usar --apply)'} · pareja ${COUPLE_ID}`);
console.log(`Usuarios viejos: ${oldUsers.length} · emparejados por email: ${userMap.size}`);
console.log(`Rubros reutilizados del proyecto nuevo: ${old.categories.length - categoriesToInsert.length}\n`);
console.table(
  plan.map((p) => ({ tabla: p.table, 'filas origen': p.source, 'ya estaban': p.existing, 'a insertar': p.rows.length })),
);

if (problems.length) {
  console.log(`\n${problems.length} problemas (no se aplica nada hasta resolverlos):`);
  for (const problem of [...new Set(problems)].slice(0, 50)) console.log(`  - ${problem}`);
  process.exit(1);
}
if (!APPLY) process.exit(0);

// ---- Escritura ----------------------------------------------------------------

for (const { table, rows } of plan) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await newDb.from(table).insert(rows.slice(i, i + 500));
    if (error) {
      console.error(`Error insertando ${table}: ${error.message}`);
      process.exit(1);
    }
  }
}

// Ahora que los gastos existen, se completa el vínculo log -> gasto.
const links = old.email_ingestion_log.filter((l) => l.expense_id);
for (const l of links) {
  const { error } = await newDb.from('fin_email_ingestion_log').update({ expense_id: l.expense_id }).eq('id', l.id);
  if (error) {
    console.error(`Error vinculando log ${l.id}: ${error.message}`);
    process.exit(1);
  }
}

console.log('\nVerificación (filas de la pareja en el proyecto nuevo):');
const counts = [];
for (const table of ORDER) {
  const q = newDb.from(table).select('*', { count: 'exact', head: true });
  const { count, error } = table === 'fin_gmail_credentials' ? await q : await q.eq('couple_id', COUPLE_ID);
  if (error) throw error;
  counts.push({ tabla: table, filas: count });
}
console.table(counts);
