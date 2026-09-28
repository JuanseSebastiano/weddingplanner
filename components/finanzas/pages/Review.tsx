'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useAccounts,
  useCategoriesByKind,
  useCreateRule,
  useGmailSync,
  useMe,
  usePendingExpenses,
  useRules,
} from '../hooks/queries';
import { ReviewCard } from '../components/ReviewCard';
import { EmptyState, ErrorState, Skeleton } from '../components/States';

export function ReviewPage() {
  const pending = usePendingExpenses();
  const categories = useCategoriesByKind('expense');
  const accounts = useAccounts();
  const rules = useRules();
  const me = useMe();
  const sync = useGmailSync();
  const createRule = useCreateRule();
  const [notice, setNotice] = useState<string | null>(null);

  const items = pending.data ?? [];
  const gmail = me.data?.gmail;

  async function handleCreateRule(merchant: string, categoryId: string) {
    setNotice(null);
    try {
      await createRule.mutateAsync({
        name: `Comercio: ${merchant}`,
        match_field: 'merchant',
        match_type: 'contains',
        pattern: merchant,
        category_id: categoryId,
        priority: 50,
      });
      setNotice(`Regla creada para "${merchant}". Los próximos gastos se categorizan solos.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No pudimos crear la regla');
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.12em] text-pending">
            {items.length} {items.length === 1 ? 'PROPUESTA' : 'PROPUESTAS'} DEL PARSER · NINGUNA
            SUMA AL TOTAL
          </span>
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Revisión</h1>
          <p className="m-0 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-muted [text-wrap:pretty]">
            Esto es lo que el parser entendió de cada mail de aviso. Corregí lo que haga falta y
            confirmá: recién ahí entra al total del mes.
          </p>
        </div>

        {gmail?.connected && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending ? 'Buscando…' : 'Buscar gastos nuevos'}
          </button>
        )}
      </div>

      {sync.data && (
        <p className="m-0 rounded-xl border border-accent/20 bg-accent/[0.07] px-3.5 py-2.5 text-[13px] text-accent-soft">
          Se revisaron {sync.data.scanned} mails: {sync.data.created} gastos nuevos,{' '}
          {sync.data.duplicates} ya conocidos, {sync.data.failed} sin parsear.
        </p>
      )}

      {notice && (
        <p className="m-0 rounded-xl border border-accent/20 bg-accent/[0.07] px-3.5 py-2.5 text-[13px] text-accent-soft">
          {notice}
        </p>
      )}

      {gmail && !gmail.connected && (
        <EmptyState
          title={
            gmail.available
              ? 'Todavía no conectaste tu casilla'
              : 'La ingesta desde Gmail no está configurada'
          }
          description={
            gmail.available
              ? 'Conectá tu Gmail y los avisos de tarjeta van a aparecer acá como propuestas, listas para confirmar.'
              : 'El servidor no tiene las credenciales de Google. Mientras tanto podés cargar los gastos a mano.'
          }
        >
          {gmail.available && (
            <Link href="/finanzas/configuracion" className="btn-primary">
              Ir a configuración
            </Link>
          )}
        </EmptyState>
      )}

      {pending.error && (
        <ErrorState
          source="ERROR · /api/review"
          title="No pudimos traer los pendientes"
          onRetry={() => void pending.refetch()}
        />
      )}

      {pending.isLoading && (
        <div className="flex flex-col gap-3.5">
          <Skeleton height={260} />
          <Skeleton height={260} />
        </div>
      )}

      {!pending.isLoading && !pending.error && items.length === 0 && gmail?.connected && (
        <EmptyState
          tone="accent"
          title="Nada por revisar"
          description={
            gmail.last_synced_at
              ? `Todos los avisos de tarjeta ya fueron confirmados o descartados. Última lectura: ${new Date(
                  gmail.last_synced_at,
                ).toLocaleString('es-AR')}.`
              : 'Todos los avisos de tarjeta ya fueron confirmados o descartados.'
          }
        />
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-3.5">
          {items.map((expense) => (
            <ReviewCard
              key={expense.id}
              expense={expense}
              categories={categories.data ?? []}
              accounts={accounts.data ?? []}
              rules={rules.data ?? []}
              onCreateRule={(merchant, categoryId) => void handleCreateRule(merchant, categoryId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
