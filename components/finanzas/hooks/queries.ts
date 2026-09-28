import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Account,
  AvailableSummary,
  CommitmentsSummary,
  BudgetInput,
  BudgetWithCategory,
  CashflowSummary,
  CategorizationRule,
  Category,
  CategoryKind,
  DashboardSummary,
  EmailIngestionLog,
  ExpenseFilters,
  ExpenseWithRelations,
  HoldingWithRelations,
  IncomeFilters,
  IncomeWithRelations,
  LedgerEntry,
  LedgerFilters,
  Paginated,
  PendingExpense,
  PortfolioSummary,
  RuleInput,
  SavingsMovementInput,
  SavingsOverview,
} from '@nf/shared';
import { api, toQueryString } from '../lib/api';

export interface MeResponse {
  user: { id: string; email: string | null; display_name: string };
  household: { id: string; name: string } | null;
  members: Array<{ id: string; display_name: string }>;
  gmail: {
    available: boolean;
    connected: boolean;
    address: string | null;
    last_synced_at: string | null;
  };
}

export interface SyncResult {
  scanned: number;
  created: number;
  duplicates: number;
  failed: number;
  errors: string[];
}

export interface ApplyRulesResult {
  scanned: number;
  updated: number;
  by_rule: Record<string, number>;
}

/** Todo lo que cambia al confirmar, crear o editar un gasto. */
function invalidateExpenseViews(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['expenses'] });
  // Un gasto confirmado en tarjeta mueve la deuda, el disponible real y
  // el próximo resumen.
  void queryClient.invalidateQueries({ queryKey: ['available'] });
  void queryClient.invalidateQueries({ queryKey: ['commitments'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['review'] });
  // El balance y el listado unificado mezclan las dos tablas: un gasto
  // que cambia también mueve el neto del mes.
  void queryClient.invalidateQueries({ queryKey: ['cashflow'] });
  void queryClient.invalidateQueries({ queryKey: ['ledger'] });
}

/** Todo lo que cambia al crear, editar o borrar un ingreso. */
function invalidateIncomeViews(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['incomes'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['cashflow'] });
  void queryClient.invalidateQueries({ queryKey: ['ledger'] });
}

/** Todo lo que cambia al crear, editar o borrar una tenencia. */
function invalidatePortfolioViews(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['holdings'] });
  void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  // Borrar una tenencia devuelve sus pesos al efectivo sin invertir
  // (savings_movements.holding_id es on delete cascade).
  void queryClient.invalidateQueries({ queryKey: ['savings'] });
}

/** Todo lo que cambia al mover plata de la caja de ahorro. */
function invalidateSavingsViews(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['savings'] });
  void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  void queryClient.invalidateQueries({ queryKey: ['holdings'] });
  // El resumen de Balance muestra cuánto se apartó en el mes.
  void queryClient.invalidateQueries({ queryKey: ['cashflow'] });
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<MeResponse>('/me') });
}

export function useDashboard(month: string) {
  return useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => api.get<DashboardSummary>(`/dashboard${toQueryString({ month })}`),
  });
}

export function useAvailable() {
  return useQuery({
    queryKey: ['available'],
    queryFn: () => api.get<AvailableSummary>('/dashboard/available'),
  });
}

export function useCommitments() {
  return useQuery({
    queryKey: ['commitments'],
    queryFn: () => api.get<CommitmentsSummary>('/dashboard/commitments'),
  });
}

export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () =>
      api.get<Paginated<ExpenseWithRelations>>(`/expenses${toQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useCashflow(month: string) {
  return useQuery({
    queryKey: ['cashflow', month],
    queryFn: () => api.get<CashflowSummary>(`/cashflow${toQueryString({ month })}`),
  });
}

export function useLedger(filters: LedgerFilters) {
  return useQuery({
    queryKey: ['ledger', filters],
    queryFn: () => api.get<Paginated<LedgerEntry>>(`/cashflow/ledger${toQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useIncomes(filters: IncomeFilters) {
  return useQuery({
    queryKey: ['incomes', filters],
    queryFn: () => api.get<Paginated<IncomeWithRelations>>(`/incomes${toQueryString({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

/**
 * Catálogo completo de rubros, de los dos tipos. Se pide una sola vez y
 * cada pantalla filtra con `useCategoriesByKind`: son pocas filas y evita
 * tener dos caches que se invalidan por separado.
 */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
}

/** Los rubros de un tipo, listos para un selector. */
export function useCategoriesByKind(kind: CategoryKind) {
  const categories = useCategories();
  return {
    ...categories,
    data: categories.data?.filter((category) => category.kind === kind),
  };
}

export function useSavings() {
  return useQuery({ queryKey: ['savings'], queryFn: () => api.get<SavingsOverview>('/savings') });
}

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get<BudgetWithCategory[]>('/budgets'),
  });
}

export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: () => api.get<Account[]>('/accounts') });
}

export function usePendingExpenses() {
  return useQuery({ queryKey: ['review'], queryFn: () => api.get<PendingExpense[]>('/review') });
}

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => api.get<CategorizationRule[]>('/rules'),
  });
}

export function useIngestionLog() {
  return useQuery({
    queryKey: ['gmail-log'],
    queryFn: () => api.get<EmailIngestionLog[]>('/gmail/log'),
  });
}

export function useHoldings() {
  return useQuery({
    queryKey: ['holdings'],
    queryFn: () => api.get<HoldingWithRelations[]>('/holdings'),
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get<PortfolioSummary>('/portfolio'),
    // La cotización se cachea 5 minutos en el backend: pedirla más seguido
    // solo agrega requests que van a devolver el mismo número.
    refetchInterval: 5 * 60 * 1000,
  });
}

// --- Mutaciones -------------------------------------------------------

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<ExpenseWithRelations>('/expenses', input),
    onSuccess: () => invalidateExpenseViews(queryClient),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api.patch<ExpenseWithRelations>(`/expenses/${id}`, patch),
    onSuccess: () => invalidateExpenseViews(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/expenses/${id}`),
    onSuccess: () => invalidateExpenseViews(queryClient),
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<IncomeWithRelations>('/incomes', input),
    onSuccess: () => invalidateIncomeViews(queryClient),
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api.patch<IncomeWithRelations>(`/incomes/${id}`, patch),
    onSuccess: () => invalidateIncomeViews(queryClient),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/incomes/${id}`),
    onSuccess: () => invalidateIncomeViews(queryClient),
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<HoldingWithRelations>('/holdings', input),
    onSuccess: () => invalidatePortfolioViews(queryClient),
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api.patch<HoldingWithRelations>(`/holdings/${id}`, patch),
    onSuccess: () => invalidatePortfolioViews(queryClient),
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/holdings/${id}`),
    onSuccess: () => invalidatePortfolioViews(queryClient),
  });
}

export function useConfirmPending() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Record<string, unknown>) =>
      api.post<ExpenseWithRelations>(`/review/${id}/confirm`, patch),
    onSuccess: () => invalidateExpenseViews(queryClient),
  });
}

export function useDiscardPending() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ExpenseWithRelations>(`/review/${id}/discard`),
    onSuccess: () => invalidateExpenseViews(queryClient),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string; kind?: CategoryKind }) =>
      api.post<Category>('/categories', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['cashflow'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      // Borrar un rubro se lleva su tope por delante (FK on delete cascade).
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      invalidateExpenseViews(queryClient);
      invalidateIncomeViews(queryClient);
    },
  });
}

/** El tope vive en el dashboard: cambiarlo mueve el aviso de esa pantalla. */
function invalidateBudgetViews(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['budgets'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateSavingsDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavingsMovementInput) => api.post('/savings/deposits', input),
    onSuccess: () => invalidateSavingsViews(queryClient),
  });
}

export function useCreateSavingsWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavingsMovementInput) => api.post('/savings/withdrawals', input),
    onSuccess: () => invalidateSavingsViews(queryClient),
  });
}

export function useInvestFromSavings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post('/savings/investments', input),
    onSuccess: () => invalidateSavingsViews(queryClient),
  });
}

export function useDeleteSavingsMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/savings/${id}`),
    onSuccess: () => invalidateSavingsViews(queryClient),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) => api.post<BudgetWithCategory>('/budgets', input),
    onSuccess: () => invalidateBudgetViews(queryClient),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.patch<BudgetWithCategory>(`/budgets/${id}`, { amount }),
    onSuccess: () => invalidateBudgetViews(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/budgets/${id}`),
    onSuccess: () => invalidateBudgetViews(queryClient),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Account>('/accounts', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['available'] });
      void queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.patch<Account>(`/accounts/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['available'] });
      void queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/accounts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      invalidateExpenseViews(queryClient);
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RuleInput) => api.post<CategorizationRule>('/rules', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<RuleInput>) =>
      api.patch<CategorizationRule>(`/rules/${id}`, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/rules/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });
}

export function useApplyRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: { dry_run?: boolean; include_categorized?: boolean }) =>
      api.post<ApplyRulesResult>('/rules/apply', options),
    onSuccess: (_result, variables) => {
      if (!variables.dry_run) invalidateExpenseViews(queryClient);
    },
  });
}

export function useGmailSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SyncResult>('/gmail/sync'),
    onSuccess: () => {
      invalidateExpenseViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['gmail-log'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useGmailConnect() {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>('/gmail/oauth/start'),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });
}

export function useGmailDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>('/gmail/connection'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}
