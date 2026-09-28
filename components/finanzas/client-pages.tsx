'use client';

import dynamic from 'next/dynamic';

/*
 * Las páginas de Finanzas eran una SPA: leen el ancho de la ventana en el
 * primer render (useBreakpoint) y hablan con la API desde el cliente. Se
 * montan sin SSR para conservar ese comportamiento sin desfasajes de
 * hidratación.
 */
export const DashboardPage = dynamic(() => import('./pages/Dashboard').then((m) => m.DashboardPage), { ssr: false });
export const ExpensesPage = dynamic(() => import('./pages/Expenses').then((m) => m.ExpensesPage), { ssr: false });
export const BalancePage = dynamic(() => import('./pages/Balance').then((m) => m.BalancePage), { ssr: false });
export const SavingsPage = dynamic(() => import('./pages/Savings').then((m) => m.SavingsPage), { ssr: false });
export const ReviewPage = dynamic(() => import('./pages/Review').then((m) => m.ReviewPage), { ssr: false });
export const SettingsPage = dynamic(() => import('./pages/Settings').then((m) => m.SettingsPage), { ssr: false });
