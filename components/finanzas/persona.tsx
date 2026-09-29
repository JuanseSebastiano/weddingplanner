'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMe } from './hooks/queries';

/**
 * De quién se ven los datos de Finanzas: '' es la pareja, si no el user_id
 * de un integrante. Se recuerda por dispositivo.
 */
const PersonaContext = createContext<{ persona: string; setPersona: (id: string) => void }>({
  persona: '',
  setPersona: () => {},
});

const KEY = 'fin-persona';

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaState] = useState('');

  useEffect(() => {
    try {
      setPersonaState(localStorage.getItem(KEY) ?? '');
    } catch {}
  }, []);

  function setPersona(id: string) {
    setPersonaState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }

  return <PersonaContext.Provider value={{ persona, setPersona }}>{children}</PersonaContext.Provider>;
}

export function usePersona(): string {
  return useContext(PersonaContext).persona;
}

export function PersonaSelector() {
  const { persona, setPersona } = useContext(PersonaContext);
  const me = useMe();
  const members = me.data?.members ?? [];
  if (members.length < 2) return null;

  const opciones = [{ id: '', display_name: 'Todos' }, ...members];
  return (
    <div className="mb-4 flex justify-end">
      <div role="group" aria-label="Ver datos de" className="inline-flex rounded-full border border-wash/[0.08] bg-sunken p-0.5">
        {opciones.map((opcion) => (
          <button
            key={opcion.id || 'todos'}
            type="button"
            aria-pressed={persona === opcion.id}
            onClick={() => setPersona(opcion.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              persona === opcion.id ? 'bg-accent text-accent-on' : 'text-ink-secondary'
            }`}
          >
            {opcion.display_name}
          </button>
        ))}
      </div>
    </div>
  );
}
