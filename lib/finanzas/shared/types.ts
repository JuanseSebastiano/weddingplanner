/**
 * Tipos de dominio compartidos entre el backend Express y el frontend React.
 * Espejan las tablas de supabase/migrations/0001_schema.sql.
 */

export type AccountType = 'credit_card' | 'debit_card' | 'bank_account' | 'cash' | 'other';
export type ExpenseSource = 'manual' | 'email';
export type ExpenseStatus = 'pending' | 'confirmed' | 'discarded';
/** Un rubro sirve para gastos o para ingresos, nunca para los dos. */
export type CategoryKind = 'expense' | 'income';
export type ParseStatus = 'parsed' | 'failed' | 'duplicate' | 'ignored';
export type RuleMatchField = 'merchant' | 'sender' | 'description';
export type RuleMatchType = 'contains' | 'equals' | 'regex';

export const ACCOUNT_TYPES: AccountType[] = [
  'credit_card',
  'debit_card',
  'bank_account',
  'cash',
  'other',
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  bank_account: 'Cuenta bancaria',
  cash: 'Efectivo',
  other: 'Otro',
};

export const CATEGORY_KINDS: CategoryKind[] = ['expense', 'income'];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  expense: 'Egreso',
  income: 'Ingreso',
};

export const RULE_MATCH_FIELD_LABELS: Record<RuleMatchField, string> = {
  merchant: 'Comercio',
  sender: 'Remitente del mail',
  description: 'Descripción',
};

export const RULE_MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  contains: 'Contiene',
  equals: 'Es igual a',
  regex: 'Expresión regular',
};

export interface Profile {
  id: string;
  couple_id: string | null;
  display_name: string;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface Account {
  id: string;
  couple_id: string;
  owner_id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  last4: string | null;
  active: boolean;
  /** Saldo cargado a mano (cuentas líquidas), para el disponible real. */
  balance: number | null;
  balance_currency: 'ARS' | 'USD';
  balance_updated_at: string | null;
  /** Tarjetas: día de cierre y de vencimiento del resumen. */
  closing_day: number | null;
  due_day: number | null;
  created_at: string;
}

/** Disponible real por moneda: líquido menos deuda de tarjeta impaga. */
export interface AvailableNow {
  currency: 'ARS' | 'USD';
  liquid: number;
  card_debt: number;
  available: number;
}

export interface CardDebt {
  account_id: string;
  name: string;
  currency: 'ARS' | 'USD';
  unpaid_since: string;
  debt: number;
}

export interface AvailableSummary {
  totals: AvailableNow[];
  cards: CardDebt[];
}

export interface Category {
  id: string;
  couple_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  kind: CategoryKind;
  created_at: string;
}

export interface Expense {
  id: string;
  couple_id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: string;
  merchant: string | null;
  description: string | null;
  expense_date: string;
  source: ExpenseSource;
  status: ExpenseStatus;
  email_ingestion_id: string | null;
  applied_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Gasto con los joins que devuelven los endpoints de listado. */
export interface ExpenseWithRelations extends Expense {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'type' | 'last4'> | null;
  profile: Pick<Profile, 'id' | 'display_name'> | null;
}

/**
 * Un ingreso: sueldo, honorarios, alquiler cobrado.
 *
 * No tiene `status` ni `source` como el gasto porque siempre se carga a
 * mano — no hay parser de mails que detecte un cobro, así que nunca hay
 * nada que confirmar.
 */
export interface Income {
  id: string;
  couple_id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  currency: string;
  /** Quién pagó: el empleador, el cliente, el inquilino. */
  payer: string | null;
  description: string | null;
  income_date: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeWithRelations extends Income {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'type' | 'last4'> | null;
  profile: Pick<Profile, 'id' | 'display_name'> | null;
}

export interface EmailIngestionLog {
  id: string;
  user_id: string;
  couple_id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_address: string | null;
  subject: string | null;
  received_at: string | null;
  raw_snippet: string | null;
  parser_id: string | null;
  parse_status: ParseStatus;
  parsed_amount: number | null;
  parsed_currency: string | null;
  parsed_merchant: string | null;
  parsed_date: string | null;
  matched_account_id: string | null;
  expense_id: string | null;
  error_detail: string | null;
  created_at: string;
}

export interface CategorizationRule {
  id: string;
  couple_id: string;
  name: string;
  priority: number;
  match_field: RuleMatchField;
  match_type: RuleMatchType;
  pattern: string;
  category_id: string;
  account_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------
// Payloads de la API
// ---------------------------------------------------------------------

export interface ExpenseInput {
  amount: number;
  currency?: string;
  category_id?: string | null;
  account_id?: string | null;
  merchant?: string | null;
  description?: string | null;
  expense_date: string;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  user_id?: string;
  category_id?: string;
  account_id?: string;
  source?: ExpenseSource;
  status?: ExpenseStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface IncomeInput {
  amount: number;
  currency?: string;
  category_id?: string | null;
  account_id?: string | null;
  payer?: string | null;
  description?: string | null;
  income_date: string;
}

export interface IncomeFilters {
  from?: string;
  to?: string;
  user_id?: string;
  category_id?: string;
  account_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

/** Gasto pendiente + el mail que lo origino, para la vista de revision. */
export interface PendingExpense extends ExpenseWithRelations {
  ingestion: Pick<
    EmailIngestionLog,
    'id' | 'from_address' | 'subject' | 'received_at' | 'raw_snippet' | 'parser_id'
  > | null;
}

export interface ConfirmExpenseInput {
  amount?: number;
  category_id?: string | null;
  account_id?: string | null;
  merchant?: string | null;
  description?: string | null;
  expense_date?: string;
}

export interface RuleInput {
  name: string;
  priority?: number;
  match_field: RuleMatchField;
  match_type: RuleMatchType;
  pattern: string;
  category_id: string;
  account_id?: string | null;
  active?: boolean;
}

// ---------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------

/**
 * Cuánto del tope hay que consumir para que el rubro empiece a avisar.
 *
 * Es una constante y no un campo por rubro a propósito: un solo número
 * es más fácil de tener en la cabeza que doce umbrales distintos, y el
 * caso en que uno querría avisar antes se resuelve bajando el tope.
 */
export const BUDGET_WARN_RATIO = 0.8;

/** `warning` es "se está acercando"; `exceeded` es "ya se pasó". */
export type BudgetState = 'ok' | 'warning' | 'exceeded';

export interface Budget {
  id: string;
  couple_id: string;
  category_id: string;
  amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithCategory extends Budget {
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
}

export interface BudgetInput {
  category_id: string;
  amount: number;
}

/** Un tope ya comparado contra lo gastado en un mes concreto. */
export interface BudgetStatus {
  budget_id: string;
  category_id: string;
  category_name: string;
  color: string;
  /** Tope mensual configurado. */
  amount: number;
  /** Gastado en el mes, solo gastos confirmados. */
  spent: number;
  /** Lo que queda del tope. Negativo si se pasó. */
  remaining: number;
  /** Porcentaje del tope consumido. Puede pasar de 100. */
  pct: number;
  state: BudgetState;
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

export interface CategoryTotal {
  category_id: string | null;
  category_name: string;
  color: string;
  total: number;
  count: number;
}

export interface UserTotal {
  user_id: string;
  display_name: string;
  total: number;
  count: number;
}

export interface MonthlyPoint {
  /** Formato YYYY-MM. */
  month: string;
  total: number;
  /** Total por usuario dentro del mes, indexado por user_id. */
  by_user: Record<string, number>;
}

export interface DashboardSummary {
  /** Mes consultado, formato YYYY-MM. */
  month: string;
  /** Total de EGRESOS del mes. Se mantiene el nombre para no cambiarle
   *  el significado a la métrica principal del dashboard. */
  month_total: number;
  previous_month_total: number;
  /** Total de ingresos del mes, para la tarjeta de balance. */
  income_total: number;
  /** Ingresos menos egresos. Negativo = se gastó más de lo que entró. */
  net: number;
  expense_count: number;
  pending_count: number;
  by_category: CategoryTotal[];
  by_user: UserTotal[];
  trend: MonthlyPoint[];
  members: Array<Pick<Profile, 'id' | 'display_name'>>;
  /**
   * Topes por rubro ya comparados contra el gasto del mes, ordenados por
   * porcentaje consumido. Vacío si el hogar no configuró ninguno.
   */
  budgets: BudgetStatus[];
}

// ---------------------------------------------------------------------
// Ingresos y egresos (sección Balance)
// ---------------------------------------------------------------------

export type LedgerKind = 'income' | 'expense';

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
};

/**
 * Una fila del listado unificado. Ingresos y egresos viven en tablas
 * distintas y se mezclan acá con una forma común, para que la vista no
 * tenga que saber de cuál salió cada uno.
 */
export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Formato YYYY-MM-DD. */
  date: string;
  /** Siempre positivo: el signo lo da `kind`. */
  amount: number;
  currency: string;
  /** Comercio en un egreso, pagador en un ingreso. */
  counterparty: string | null;
  description: string | null;
  category: Pick<Category, 'id' | 'name' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'type' | 'last4'> | null;
  profile: Pick<Profile, 'id' | 'display_name'> | null;
  created_at: string;
}

export interface LedgerFilters {
  from?: string;
  to?: string;
  kind?: LedgerKind;
  user_id?: string;
  category_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CashflowPoint {
  /** Formato YYYY-MM. */
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CashflowSummary {
  month: string;
  income_total: number;
  expense_total: number;
  net: number;
  /** Porcentaje del ingreso que no se gastó. `null` si no hubo ingresos:
   *  sin denominador la tasa no significa nada y no se muestra. */
  savings_rate: number | null;
  income_count: number;
  expense_count: number;
  previous_net: number;
  /**
   * Lo que se apartó para ahorrar en el mes. No está descontado del neto:
   * una transferencia a ahorros no es un gasto, así que `net` sigue siendo
   * "cuánto sobró" y este número dice cuánto de eso ya se guardó.
   */
  savings_total: number;
  /** Desglose del ingreso del mes por rubro de ingreso. */
  by_income_category: CategoryTotal[];
  /** 12 meses hasta el consultado. */
  trend: CashflowPoint[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// ---------------------------------------------------------------------
// Ahorros: tenencias de CEDEARs (sección Ahorros)
// ---------------------------------------------------------------------

/** Posición consolidada en un CEDEAR, cargada a mano. */
export interface Holding {
  id: string;
  couple_id: string;
  user_id: string;
  /** Símbolo tal como cotiza en BYMA, ej. "AAPL", "MELI". */
  ticker: string;
  quantity: number;
  /** Costo promedio por unidad, en pesos. */
  avg_cost: number;
  broker: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingWithRelations extends Holding {
  profile: Pick<Profile, 'id' | 'display_name'> | null;
}

export interface HoldingInput {
  ticker: string;
  quantity: number;
  avg_cost: number;
  broker?: string;
  notes?: string | null;
}

/** Cotización resuelta para un ticker. `price` es null si la fuente no la tiene. */
export interface Quote {
  ticker: string;
  price: number | null;
  /** % de variación del día, si la fuente lo informa. */
  change_pct: number | null;
}

/** Una tenencia con su cotización y los cálculos ya resueltos. */
export interface HoldingPosition extends HoldingWithRelations {
  quote: Quote | null;
  /** quantity * avg_cost. */
  cost_basis: number;
  /** quantity * quote.price. Null si no hay cotización. */
  market_value: number | null;
  /** market_value - cost_basis. Null si no hay cotización. */
  gain: number | null;
  /** gain / cost_basis * 100. Null si no hay cotización. */
  gain_pct: number | null;
}

/** Cotización del dólar para ver la cartera en USD, no solo en pesos. */
// ---------------------------------------------------------------------
// Caja de ahorro
// ---------------------------------------------------------------------

/**
 * `deposit` es plata que se apartó para ahorrar (la "transferencia" que se
 * carga desde el formulario de gastos), `withdrawal` es plata que volvió a
 * la cuenta, `investment` son pesos que se convirtieron en una tenencia.
 */
export type SavingsMovementKind = 'deposit' | 'withdrawal' | 'investment';

export const SAVINGS_MOVEMENT_LABELS: Record<SavingsMovementKind, string> = {
  deposit: 'Ingreso a ahorros',
  withdrawal: 'Retiro',
  investment: 'Inversión',
};

export interface SavingsMovement {
  id: string;
  couple_id: string;
  user_id: string;
  kind: SavingsMovementKind;
  amount: number;
  /** Formato YYYY-MM-DD. */
  moved_at: string;
  account_id: string | null;
  holding_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsMovementWithRelations extends SavingsMovement {
  account: Pick<Account, 'id' | 'name' | 'last4'> | null;
  holding: Pick<Holding, 'id' | 'ticker'> | null;
  profile: Pick<Profile, 'id' | 'display_name'> | null;
}

/** Lo que manda el formulario para apartar o retirar plata. */
export interface SavingsMovementInput {
  amount: number;
  moved_at: string;
  account_id?: string | null;
  description?: string | null;
}

/** Convertir efectivo de la caja en una tenencia. */
export interface InvestFromSavingsInput {
  ticker: string;
  quantity: number;
  /** Precio por unidad pagado, en pesos. El monto sale de cantidad × precio. */
  price: number;
  moved_at: string;
  broker?: string;
  notes?: string | null;
}

/** Estado de la caja de ahorro, todo en pesos. */
export interface SavingsCash {
  /** Depósitos − retiros − inversiones. Nunca debería ser negativo. */
  available: number;
  deposited: number;
  withdrawn: number;
  invested: number;
  /** Lo apartado en el mes en curso, para el resumen del mes. */
  deposited_this_month: number;
}

/** Respuesta de GET /api/savings. */
export interface SavingsOverview {
  movements: SavingsMovementWithRelations[];
  cash: SavingsCash;
}

export interface FxRate {
  /** Pesos por dólar (lado venta: lo que costaría comprarlos hoy). */
  rate: number;
  /** Casa de origen de la cotización, ej. "CCL". */
  source: string;
  updated_at: string;
}

export interface PortfolioSummary {
  positions: HoldingPosition[];
  /** Suma de cost_basis de todas las posiciones, tengan cotización o no. */
  total_cost_basis: number;
  /** Suma de market_value de las posiciones cotizadas. Null si ninguna la tiene. */
  total_market_value: number | null;
  total_gain: number | null;
  total_gain_pct: number | null;
  /** Cuándo se resolvió la cotización. Null si la fuente no respondió nunca. */
  quoted_at: string | null;
  /** Si es false, la fuente externa no respondió: se muestra igual el costo. */
  quotes_available: boolean;
  /** Null si la fuente de tipo de cambio no respondió: no se puede ver en USD. */
  fx: FxRate | null;
  /** Efectivo apartado que todavía no se invirtió. */
  cash: SavingsCash;
  /**
   * Ahorro total del hogar: lo invertido más el efectivo sin invertir. Usa
   * el valor de mercado si hay cotización y el costo si no la hay, para no
   * dejar el número en null solo porque la fuente externa falló.
   */
  total_savings: number;
}
