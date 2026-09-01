"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Armchair,
  Wallet,
  CreditCard,
  CheckSquare,
  Briefcase,
  Sparkles,
  CalendarDays,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Todas las secciones. En escritorio se ven todas; en celular, las 4 primeras + "Más". */
const SECCIONES = [
  { href: "/", label: "Inicio", corto: "Inicio", icon: Home },
  { href: "/invitados", label: "Invitados", corto: "Invitados", icon: Users },
  { href: "/mesas", label: "Mesas", corto: "Mesas", icon: Armchair },
  { href: "/presupuesto", label: "Presupuesto", corto: "Plata", icon: Wallet },
  { href: "/pagos", label: "Pagos", corto: "Pagos", icon: CreditCard },
  { href: "/tareas", label: "Tareas", corto: "Tareas", icon: CheckSquare },
  {
    href: "/proveedores",
    label: "Proveedores",
    corto: "Prov.",
    icon: Briefcase,
  },
  { href: "/ideas", label: "Ideas", corto: "Ideas", icon: Sparkles },
  {
    href: "/agenda-del-dia",
    label: "Agenda del día",
    corto: "Agenda",
    icon: CalendarDays,
  },
];

const TABS_MOBILE = ["/", "/invitados", "/presupuesto", "/tareas"];

function esActiva(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Menú lateral, sólo de 1024px para arriba. */
export function Sidebar({
  nombres,
  fecha,
  email,
}: {
  nombres: string;
  fecha: string;
  email: string;
}) {
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
        <span className="min-w-0">
          <span className="block truncate font-serif text-[17px] leading-tight">
            {nombres}
          </span>
          <span className="block text-[11.5px] leading-tight text-subtle">
            {fecha}
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {SECCIONES.map(({ href, label, icon: Icon }) => {
          const activa = esActiva(pathname, href);
          return (
            <Link
              key={href}
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
          );
        })}
      </nav>

      <Link
        href="/mas"
        className="mt-auto flex items-center gap-2.5 border-t border-border-soft px-2.5 pt-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-[11.5px] font-bold text-sage">
          {email[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 truncate">{email}</span>
      </Link>
    </aside>
  );
}

/** Barra inferior, sólo por debajo de 1024px. */
export function BottomNav() {
  const pathname = usePathname();
  const tabs = TABS_MOBILE.map(
    (href) => SECCIONES.find((s) => s.href === href)!,
  );

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map(({ href, corto, icon: Icon }) => {
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
                {corto}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href="/mas"
            aria-current={pathname.startsWith("/mas") ? "page" : undefined}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
              pathname.startsWith("/mas")
                ? "font-semibold text-primary"
                : "text-subtle",
            )}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />
            Más
          </Link>
        </li>
      </ul>
    </nav>
  );
}
