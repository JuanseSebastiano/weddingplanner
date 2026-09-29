'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonaProvider, PersonaSelector } from './persona';
import './finanzas.css';

/** Proveedor de react-query, persona elegida y scope `.fin` para los estilos del módulo. */
export function FinanzasShell({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PersonaProvider>
        <div className="fin text-ink-primary">
          <PersonaSelector />
          {children}
        </div>
      </PersonaProvider>
    </QueryClientProvider>
  );
}
