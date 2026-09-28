import Link from "next/link";
import { ChevronRight } from "lucide-react";

const LINKS = [
  { href: "/mesas", label: "Mesas" },
  { href: "/pagos", label: "Pagos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/comparador", label: "Comparador de presupuestos" },
  { href: "/ideas", label: "Ideas" },
  { href: "/agenda-del-dia", label: "Agenda del día" },
];

export default function MasPage() {
  return (
    <main>
      <h1 className="font-serif text-2xl font-normal lg:text-[28px]">Más</h1>

      <ul className="mt-4 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-14 items-center justify-between px-4 active:bg-muted"
            >
              {label}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
