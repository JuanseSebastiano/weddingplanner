import { useState, type FormEvent } from 'react';
import {
  RULE_MATCH_FIELD_LABELS,
  RULE_MATCH_TYPE_LABELS,
  type Category,
  type RuleMatchField,
  type RuleMatchType,
} from '@nf/shared';
import { useCreateRule } from '../hooks/queries';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FormError } from './States';

export function RuleForm({ categories, onDone }: { categories: Category[]; onDone?: () => void }) {
  const create = useCreateRule();
  const { compact } = useBreakpoint();

  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [matchField, setMatchField] = useState<RuleMatchField>('merchant');
  const [matchType, setMatchType] = useState<RuleMatchType>('contains');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('100');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!categoryId) {
      setError('Elegí a qué rubro asigna la regla.');
      return;
    }

    try {
      await create.mutateAsync({
        name: name.trim() || `${RULE_MATCH_FIELD_LABELS[matchField]}: ${pattern.trim()}`,
        pattern: pattern.trim(),
        match_field: matchField,
        match_type: matchType,
        category_id: categoryId,
        priority: Number(priority) || 100,
      });
      setName('');
      setPattern('');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear la regla');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex animate-[nf-rise_280ms_ease_both] flex-col gap-3 rounded-xl border border-wash/[0.06] bg-sunken p-3.5"
    >
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: compact ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))' }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Nombre</span>
          <input
            className="input"
            placeholder="Supermercados"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Asigna el rubro</span>
          <select
            className="input"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            <option value="">Elegí un rubro</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Campo</span>
          <select
            className="input"
            value={matchField}
            onChange={(event) => setMatchField(event.target.value as RuleMatchField)}
          >
            {Object.entries(RULE_MATCH_FIELD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Comparación</span>
          <select
            className="input"
            value={matchType}
            onChange={(event) => setMatchType(event.target.value as RuleMatchType)}
          >
            {Object.entries(RULE_MATCH_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Patrón</span>
          <input
            className="input"
            placeholder={matchType === 'regex' ? '(coto|jumbo|carrefour)' : 'coto'}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-ink-muted">Prioridad</span>
          <input
            className="input tabular"
            inputMode="numeric"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          />
          <span className="text-[10.5px] text-ink-faint">Menor número, se evalúa primero.</span>
        </label>
      </div>

      {error && <FormError message={error} />}

      <div className="flex justify-end gap-2.5">
        {onDone && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear regla'}
        </button>
      </div>
    </form>
  );
}
