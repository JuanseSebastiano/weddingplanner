'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  BUDGET_WARN_RATIO,
  RULE_MATCH_TYPE_LABELS,
  formatCurrency,
  type Account,
  type AccountType,
  type CategoryKind,
} from '@nf/shared';
import {
  useAccounts,
  useApplyRules,
  useBudgets,
  useCategoriesByKind,
  useCreateAccount,
  useCreateBudget,
  useCreateCategory,
  useDeleteAccount,
  useUpdateAccount,
  useDeleteBudget,
  useDeleteCategory,
  useDeleteRule,
  useGmailConnect,
  useGmailDisconnect,
  useGmailSync,
  useIngestionLog,
  useMe,
  useRules,
  useUpdateBudget,
} from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTheme } from '../hooks/useTheme';
import { cardHex, categoryColor, contrastRatio } from '../lib/theme';
import { RuleForm } from '../components/RuleForm';
import { FormError } from '../components/States';

function Panel({
  title,
  meta,
  action,
  children,
  accent = false,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`flex flex-col gap-3.5 rounded-[18px] border px-6 py-[22px] ${
        accent ? 'border-accent/20' : 'border-wash/[0.06] bg-card'
      }`}
      style={
        accent
          ? {
              background:
                'linear-gradient(160deg, rgb(var(--nf-accent)/8%), rgb(var(--nf-card)) 55%)',
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        {meta && <span className="font-mono text-[10px] text-ink-faint">{meta}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

function GmailPanel() {
  const me = useMe();
  const connect = useGmailConnect();
  const disconnect = useGmailDisconnect();
  const sync = useGmailSync();
  const log = useIngestionLog();
  const params = useSearchParams();

  const gmail = me.data?.gmail;
  const justConnected = params.get('gmail') === 'conectado';
  // El callback de Google vuelve acá con el motivo cuando la conexión falla.
  const connectError =
    params.get('gmail') === 'error'
      ? (params.get('motivo') ?? 'No pudimos conectar la casilla.')
      : null;

  return (
    <Panel title="Ingesta desde Gmail" accent>
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] text-ink-muted">
            {gmail?.connected
              ? `${gmail.address} · lee solo avisos de tarjeta`
              : 'Los avisos de tarjeta se convierten en gastos pendientes de confirmar.'}
          </span>
          {justConnected && (
            <span className="text-[12.5px] text-accent-soft">Casilla conectada correctamente.</span>
          )}
          {connectError && <FormError message={connectError} />}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {gmail?.connected ? (
            <>
              <span className="inline-flex items-center gap-[7px] font-mono text-[11px] text-accent-soft">
                <span
                  className="h-[7px] w-[7px] rounded-full bg-accent"
                  style={{ boxShadow: '0 0 0 4px rgb(var(--nf-accent)/18%)' }}
                />
                ACTIVO
                {gmail.last_synced_at
                  ? ` · ${new Date(gmail.last_synced_at).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
              >
                {sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                Desconectar
              </button>
            </>
          ) : gmail?.available ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              Conectar mi Gmail
            </button>
          ) : (
            <span className="font-mono text-[11px] text-ink-faint">SIN CONFIGURAR EN EL SERVIDOR</span>
          )}
        </div>
      </div>

      {gmail?.connected && (log.data?.length ?? 0) > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[12.5px] text-accent-soft">
            Ver los últimos mails procesados
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {(log.data ?? []).slice(0, 20).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 border-b border-wash/[0.05] py-1.5 text-[11.5px] last:border-0"
              >
                <span
                  className={`font-mono text-[10px] ${
                    entry.parse_status === 'parsed' ? 'text-accent-soft' : 'text-ink-faint'
                  }`}
                >
                  {entry.parse_status.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{entry.subject}</span>
                {entry.parsed_amount !== null && (
                  <span className="tabular font-mono text-ink-soft">{entry.parsed_amount}</span>
                )}
                {entry.error_detail && (
                  <span className="w-full text-[10.5px] text-ink-faint">{entry.error_detail}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function CategoriesPanel({ kind }: { kind: CategoryKind }) {
  const categories = useCategoriesByKind(kind);
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const income = kind === 'income';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim(), kind });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el rubro');
    }
  }

  return (
    <Panel
      title={income ? 'Rubros de ingreso' : 'Rubros de egreso'}
      meta={`COLOR BASE → COLOR EN ${theme === 'light' ? 'CLARO' : 'OSCURO'}`}
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(categories.data ?? []).map((category, index) => {
          const display = categoryColor(category.color, index, theme);
          const ratio = contrastRatio(display, cardHex(theme));
          return (
            <li
              key={category.id}
              className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 rounded-xl border border-wash/[0.05] bg-sunken px-3 py-2.5"
            >
              <span className="inline-flex items-center gap-2.5 text-[13px] text-ink-bright">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: display }}
                  aria-hidden
                />
                {category.name}
              </span>

              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-faint">
                <span
                  className="h-3.5 w-3.5 rounded"
                  style={{ background: category.color }}
                  aria-hidden
                />
                {category.color.toUpperCase()}
                <span className="text-ink-dim">→</span>
                <span className="h-3.5 w-3.5 rounded" style={{ background: display }} aria-hidden />
                {display.toUpperCase()}
              </span>

              <span className="tabular font-mono text-[10.5px] text-ink-secondary">
                {ratio.toFixed(1)}:1
              </span>

              {!category.is_default && (
                <button
                  type="button"
                  className="text-[11px] text-ink-faint underline hover:text-danger"
                  onClick={() => remove.mutate(category.id)}
                >
                  borrar
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
        {income
          ? 'Los rubros de ingreso son independientes de los de egreso: un ingreso nunca puede imputarse a "Supermercado" ni al revés, así que los desgloses no se mezclan. '
          : ''}
        El color guardado en la base no se toca: se recalcula la luminosidad para que se lea bien
        sobre el fondo {theme === 'light' ? 'claro' : 'oscuro'} actual, conservando el tono. Si
        editás el color, el mapeo se recalcula.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <input
          className="input"
          placeholder={income ? 'Nuevo rubro de ingreso' : 'Nuevo rubro de egreso'}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <button type="submit" className="btn-primary shrink-0" disabled={create.isPending}>
          Agregar
        </button>
      </form>

      {error && <FormError message={error} />}
    </Panel>
  );
}

/** "1.234,56" -> 1234.56. Mismo parseo que el resto de los montos. */
function parseAmount(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

function formatAmount(value: number): string {
  return Number(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Una fila de tope: el monto se edita en el lugar y se guarda si cambió. */
function BudgetRow({
  id,
  name,
  amount,
  onError,
}: {
  id: string;
  name: string;
  amount: number;
  onError: (message: string | null) => void;
}) {
  const update = useUpdateBudget();
  const remove = useDeleteBudget();
  const [draft, setDraft] = useState(() => formatAmount(amount));

  // La comparación es numérica y no de texto: al guardar "150000" el
  // servidor devuelve 150000, que se re-formatea como "150.000,00". Contra
  // el string, eso dejaría el botón "guardar" pegado para siempre aunque el
  // valor ya esté guardado. Un draft que no parsea cuenta como sucio, para
  // que se pueda intentar guardar y ver el error de validación.
  const parsedDraft = parseAmount(draft);
  const dirty = !Number.isFinite(parsedDraft) || parsedDraft !== Number(amount);

  async function save() {
    const parsed = parseAmount(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onError('El tope tiene que ser un número mayor a cero.');
      return;
    }
    onError(null);
    try {
      await update.mutateAsync({ id, amount: parsed });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No pudimos guardar el tope');
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-wash/[0.05] bg-sunken px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-bright">{name}</span>

      <input
        className="input tabular w-[130px] shrink-0 text-right"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={`Tope mensual de ${name}`}
      />

      {dirty ? (
        <button
          type="button"
          className="shrink-0 text-[11px] text-accent-soft underline hover:text-accent"
          onClick={() => void save()}
          disabled={update.isPending}
        >
          {update.isPending ? 'guardando…' : 'guardar'}
        </button>
      ) : (
        <button
          type="button"
          className="shrink-0 text-[11px] text-ink-faint underline hover:text-danger"
          onClick={() => remove.mutate(id)}
          disabled={remove.isPending}
        >
          borrar
        </button>
      )}
    </li>
  );
}

function BudgetsPanel() {
  const budgets = useBudgets();
  const categories = useCategoriesByKind('expense');
  const create = useCreateBudget();
  const { compact } = useBreakpoint();

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = budgets.data ?? [];
  const withBudget = new Set(rows.map((budget) => budget.category_id));
  // Un rubro que ya tiene tope no vuelve a aparecer en el selector: se
  // edita el que está, que es lo que hace el backend igual (409).
  const available = (categories.data ?? []).filter((category) => !withBudget.has(category.id));

  const total = rows.reduce((sum, budget) => sum + Number(budget.amount), 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseAmount(amount);
    if (!categoryId) {
      setError('Elegí a qué rubro le ponés tope.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresá un tope mayor a cero.');
      return;
    }

    try {
      await create.mutateAsync({ category_id: categoryId, amount: parsed });
      setCategoryId('');
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el tope');
    }
  }

  return (
    <Panel
      title="Topes de presupuesto"
      meta={rows.length > 0 ? `${formatCurrency(total)} POR MES` : undefined}
    >
      <p className="m-0 text-xs leading-relaxed text-ink-secondary [text-wrap:pretty]">
        El tope es mensual y se repite todos los meses: se compara contra lo gastado en ese rubro
        dentro del mes que estés mirando en el dashboard, contando solo gastos confirmados. Cuando
        un rubro llega al {Math.round(BUDGET_WARN_RATIO * 100)}% del tope, aparece un aviso arriba
        del dashboard.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((budget) => (
          <BudgetRow
            key={budget.id}
            id={budget.id}
            name={budget.category?.name ?? 'Sin rubro'}
            amount={Number(budget.amount)}
            onError={setError}
          />
        ))}
        {rows.length === 0 && (
          <li className="py-2 text-[13px] text-ink-faint">Todavía no hay topes configurados.</li>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'minmax(0,1.4fr) minmax(0,1fr)' }}
      >
        <select
          className="input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">
            {available.length > 0 ? 'Elegí un rubro' : 'Todos los rubros ya tienen tope'}
          </option>
          {available.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <input
          className="input tabular text-right"
          inputMode="decimal"
          placeholder="150.000,00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <div className={compact ? '' : 'col-span-2'}>
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending || available.length === 0}
          >
            {create.isPending ? 'Guardando…' : 'Poner tope'}
          </button>
        </div>
      </form>

      {error && <FormError message={error} />}
    </Panel>
  );
}

function RulesPanel() {
  const rules = useRules();
  const categories = useCategoriesByKind('expense');
  const remove = useDeleteRule();
  const apply = useApplyRules();
  const { theme } = useTheme();
  const [showForm, setShowForm] = useState(false);

  const catalog = categories.data ?? [];
  const colorOf = (categoryId: string) => {
    const index = catalog.findIndex((c) => c.id === categoryId);
    return categoryColor(catalog[index]?.color ?? null, index >= 0 ? index : 0, theme);
  };

  return (
    <Panel
      title="Reglas de categorización"
      action={
        <button
          type="button"
          className="rounded-[9px] border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent-soft hover:bg-accent/[0.18]"
          onClick={() => setShowForm((previous) => !previous)}
        >
          {showForm ? 'Cerrar' : 'Nueva'}
        </button>
      }
    >
      {showForm && <RuleForm categories={catalog} onDone={() => setShowForm(false)} />}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(rules.data ?? []).map((rule) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-wash/[0.05] bg-sunken px-3 py-2.5"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-mono text-xs leading-snug text-ink-soft">
                {rule.match_field} {RULE_MATCH_TYPE_LABELS[rule.match_type].toLowerCase()} “
                {rule.pattern}”
              </span>
              <span className="text-[11.5px] text-ink-faint">
                prioridad {rule.priority}
                {rule.active ? '' : ' · inactiva'}
              </span>
            </span>

            <span
              className="chip shrink-0 bg-wash/[0.05] text-[11.5px]"
              style={{ color: colorOf(rule.category_id) }}
            >
              <span
                className="h-[7px] w-[7px] rounded-[2px]"
                style={{ background: colorOf(rule.category_id) }}
                aria-hidden
              />
              {catalog.find((c) => c.id === rule.category_id)?.name ?? '—'}
            </span>

            <button
              type="button"
              className="shrink-0 text-[11px] text-ink-faint underline hover:text-danger"
              onClick={() => remove.mutate(rule.id)}
            >
              borrar
            </button>
          </li>
        ))}
        {(rules.data?.length ?? 0) === 0 && (
          <li className="py-2 text-[13px] text-ink-faint">Todavía no hay reglas.</li>
        )}
      </ul>

      <button
        type="button"
        className="rounded-xl border border-dashed border-wash/[0.14] py-2.5 text-[12.5px] text-ink-secondary transition-colors hover:border-accent/40 hover:text-ink-primary"
        onClick={() => apply.mutate({ dry_run: false })}
        disabled={apply.isPending}
      >
        {apply.isPending ? 'Aplicando…' : 'Aplicar reglas al histórico'}
      </button>

      {apply.data && (
        <p className="m-0 rounded-xl border border-accent/20 bg-accent/[0.07] px-3 py-2 text-[12.5px] text-accent-soft">
          Se categorizaron {apply.data.updated} de {apply.data.scanned} gastos sin rubro.
        </p>
      )}
    </Panel>
  );
}

function dayOrNull(value: string): number | null {
  const day = Number.parseInt(value, 10);
  return day >= 1 && day <= 31 ? day : null;
}

function amountOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
}

/** Saldo (cuentas) o cierre/vencimiento (tarjetas), editable por su dueño. */
function AccountMoneyFields({ account, editable }: { account: Account; editable: boolean }) {
  const update = useUpdateAccount();
  const isCard = account.type === 'credit_card';
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');

  const summary = isCard
    ? account.closing_day
      ? `Cierra el ${account.closing_day}${account.due_day ? ` · vence el ${account.due_day}` : ''}`
      : 'Sin día de cierre'
    : account.balance !== null
      ? `Saldo ${formatCurrency(account.balance, account.balance_currency)}`
      : 'Sin saldo cargado';

  function start() {
    setFirst(String((isCard ? account.closing_day : account.balance) ?? ''));
    setSecond(String((isCard ? account.due_day : account.balance_currency) ?? 'ARS'));
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await update.mutateAsync({
      id: account.id,
      ...(isCard
        ? { closing_day: dayOrNull(first), due_day: dayOrNull(second) }
        : { balance: amountOrNull(first), balance_currency: second }),
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <span className="text-[11.5px] text-ink-secondary">
        {summary}
        {editable && (
          <button type="button" className="ml-2 text-ink-faint underline" onClick={start}>
            editar
          </button>
        )}
      </span>
    );
  }

  return (
    <form onSubmit={save} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input
        className="input tabular !w-28 !py-1.5"
        inputMode={isCard ? 'numeric' : 'decimal'}
        placeholder={isCard ? 'Cierre' : 'Saldo'}
        value={first}
        onChange={(event) => setFirst(event.target.value)}
      />
      {isCard ? (
        <input
          className="input tabular !w-28 !py-1.5"
          inputMode="numeric"
          placeholder="Vencimiento"
          value={second}
          onChange={(event) => setSecond(event.target.value)}
        />
      ) : (
        <select
          className="input !w-24 !py-1.5"
          value={second}
          onChange={(event) => setSecond(event.target.value)}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      )}
      <button type="submit" className="btn-secondary !py-1.5" disabled={update.isPending}>
        Guardar
      </button>
    </form>
  );
}

function AccountsPanel() {
  const accounts = useAccounts();
  const me = useMe();
  const create = useCreateAccount();
  const remove = useDeleteAccount();
  const { compact } = useBreakpoint();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('credit_card');
  const [bankName, setBankName] = useState('');
  const [last4, setLast4] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceCurrency, setBalanceCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCard = type === 'credit_card';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        type,
        bank_name: bankName.trim() || null,
        last4: last4.trim() || null,
        ...(isCard
          ? { closing_day: dayOrNull(closingDay), due_day: dayOrNull(dueDay) }
          : { balance: amountOrNull(balance), balance_currency: balanceCurrency }),
      });
      setName('');
      setBankName('');
      setLast4('');
      setBalance('');
      setClosingDay('');
      setDueDay('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear la cuenta');
    }
  }

  return (
    <Panel title="Tarjetas y cuentas">
      <p className="m-0 text-xs leading-relaxed text-ink-secondary">
        Los últimos 4 dígitos permiten que un gasto detectado en un mail se impute solo a la tarjeta
        correcta. El saldo de las cuentas y el cierre y vencimiento de las tarjetas alimentan el
        disponible real.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {(accounts.data ?? []).map((account) => (
          <li
            key={account.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-wash/[0.05] bg-sunken px-3.5 py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] text-ink-primary">
                {account.name}
                {account.last4 && <span className="text-ink-faint"> ··{account.last4}</span>}
              </span>
              <span className="font-mono text-[11px] text-ink-faint">
                {ACCOUNT_TYPE_LABELS[account.type].toUpperCase()}
                {account.bank_name ? ` · ${account.bank_name.toUpperCase()}` : ''}
              </span>
              <AccountMoneyFields account={account} editable={account.owner_id === me.data?.user.id} />
            </span>
            {account.owner_id === me.data?.user.id && (
              <button
                type="button"
                className="shrink-0 text-[11px] text-ink-faint underline hover:text-danger"
                onClick={() => remove.mutate(account.id)}
              >
                borrar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))' }}
      >
        <input
          className="input"
          placeholder="Visa Santander"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <select
          className="input"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {ACCOUNT_TYPES.map((value) => (
            <option key={value} value={value}>
              {ACCOUNT_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Banco"
          value={bankName}
          onChange={(event) => setBankName(event.target.value)}
        />
        <input
          className="input tabular"
          placeholder="Últimos 4"
          inputMode="numeric"
          maxLength={4}
          value={last4}
          onChange={(event) => setLast4(event.target.value)}
        />
        {isCard ? (
          <>
            <input
              className="input tabular"
              placeholder="Día de cierre"
              inputMode="numeric"
              value={closingDay}
              onChange={(event) => setClosingDay(event.target.value)}
            />
            <input
              className="input tabular"
              placeholder="Día de vencimiento"
              inputMode="numeric"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
            />
          </>
        ) : (
          <>
            <input
              className="input tabular"
              placeholder="Saldo actual"
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
            <select
              className="input"
              value={balanceCurrency}
              onChange={(event) => setBalanceCurrency(event.target.value as 'ARS' | 'USD')}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </>
        )}
        <div className={compact ? '' : 'col-span-2'}>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            Agregar cuenta
          </button>
        </div>
      </form>

      {error && <FormError message={error} />}
    </Panel>
  );
}

export function SettingsPage() {
  const me = useMe();
  const { compact } = useBreakpoint();

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">
          HOGAR · {me.data?.members.length ?? 0} MIEMBROS
        </span>
        <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Configuración</h1>
        {me.data?.household && (
          <p className="m-0 text-[13px] text-ink-muted">
            “{me.data.household.name}” · {me.data.members.map((m) => m.display_name).join(' y ')}
          </p>
        )}
      </div>

      <GmailPanel />

      <div
        className="grid items-start gap-3.5"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))' }}
      >
        <div className="flex flex-col gap-3.5">
          <BudgetsPanel />
          <CategoriesPanel kind="expense" />
          <CategoriesPanel kind="income" />
        </div>
        <div className="flex flex-col gap-3.5">
          <RulesPanel />
          <AccountsPanel />
        </div>
      </div>
    </div>
  );
}
