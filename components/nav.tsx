"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Heart,
  Wallet,
  Plane,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { salir } from "@/app/(app)/actions";

/** Módulos de la app: barra inferior en celular, menú lateral en escritorio. */
const MODULOS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/boda", label: "Boda", icon: Heart },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/viaje", label: "Viaje", icon: Plane },
];

/** Secciones de cada módulo. En escritorio cuelgan del módulo; en celular, tira arriba. */
const SECCIONES_BODA = [
  { href: "/boda", label: "Resumen" },
  { href: "/boda/invitados", label: "Invitados" },
  { href: "/boda/mesas", label: "Mesas" },
  { href: "/boda/presupuesto", label: "Presupuesto" },
  { href: "/boda/pagos", label: "Pagos" },
  { href: "/boda/tareas", label: "Tareas" },
  { href: "/boda/proveedores", label: "Proveedores" },
  { href: "/boda/comparador", label: "Comparador" },
  { href: "/boda/ideas", label: "Ideas" },
  { href: "/boda/agenda-del-dia", label: "Agenda del día" },
];

const SECCIONES_FINANZAS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/gastos", label: "Gastos" },
  { href: "/finanzas/balance", label: "Ingresos y egresos" },
  { href: "/finanzas/ahorros", label: "Ahorros" },
  { href: "/finanzas/revision", label: "Revisión" },
  { href: "/finanzas/configuracion", label: "Configuración" },
];

const SECCIONES_VIAJE = [
  { href: "/viaje", label: "Itinerario" },
  { href: "/viaje/vuelos", label: "Vuelos" },
  { href: "/viaje/trenes", label: "Trenes" },
  { href: "/viaje/reservas", label: "Reservas" },
  { href: "/viaje/crucero", label: "Crucero" },
  { href: "/viaje/gastos", label: "Gastos" },
];

const SECCIONES: Record<string, { href: string; label: string }[]> = {
  "/boda": SECCIONES_BODA,
  "/finanzas": SECCIONES_FINANZAS,
  "/viaje": SECCIONES_VIAJE,
};

function esActiva(pathname: string, href: string, exacta = false) {
  if (href === "/" || exacta) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Menú lateral, sólo de 1024px para arriba. */
export function Sidebar({ nombres }: { nombres: string }) {
  const pathname = usePathname();

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-card px-3.5 pb-4 pt-5 lg:flex">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-lg leading-none text-primary-foreground">
          {nombres
            .split(" & ")
            .map((n) => n[0])
            .join("")}
        </span>
        <span className="min-w-0 truncate font-serif text-[17px] leading-tight">
          {nombres}
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {MODULOS.map(({ href, label, icon: Icon }) => {
          const activa = esActiva(pathname, href);
          return (
            <div key={href}>
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors",
                  activa
                    ? "bg-primary-soft font-semibold text-primary-ink"
                    : "font-medium text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={activa ? 2.2 : 1.8}
                />
                {label}
              </Link>
              {SECCIONES[href] && activa && (
                <div className="my-1 ml-6 flex flex-col border-l border-border-soft pl-2">
                  {SECCIONES[href].map((s) => {
                    const sub = esActiva(pathname, s.href, s.href === href);
                    return (
                      <Link
                        key={s.href}
                        href={s.href}
                        aria-current={sub ? "page" : undefined}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[13px]",
                          sub
                            ? "font-semibold text-primary-ink"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <form action={salir} className="mt-auto border-t border-border-soft pt-3">
        <button className="flex items-center gap-2.5 px-2.5 text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}

/** Barra inferior, sólo por debajo de 1024px. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {MODULOS.map(({ href, label, icon: Icon }) => {
          const activa = esActiva(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                  activa ? "font-semibold text-primary" : "text-subtle",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={activa ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tira de secciones de un módulo, sólo en celular (en escritorio están en el lateral). */
export function ModuloTabs({ modulo }: { modulo: "/boda" | "/finanzas" | "/viaje" }) {
  const pathname = usePathname();

  return (
    <nav className="no-print -mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
      <ul className="flex w-max gap-1.5">
        {SECCIONES[modulo].map((s) => {
          const activa = esActiva(pathname, s.href, s.href === modulo);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px]",
                  activa
                    ? "border-primary bg-primary-soft font-semibold text-primary-ink"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
