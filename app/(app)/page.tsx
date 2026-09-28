import Link from "next/link";
import { ChevronRight, Heart, Wallet, Plane } from "lucide-react";
import { salir } from "./actions";
import { Button } from "@/components/ui/button";

const MODULOS = [
  { href: "/boda", label: "Boda", icon: Heart },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/viaje", label: "Viaje", icon: Plane },
];

export default function InicioPage() {
  return (
    <main>
      <h1 className="font-serif text-2xl font-normal lg:text-[28px]">Inicio</h1>

      <ul className="mt-4 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {MODULOS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-14 items-center gap-3 px-4 active:bg-muted"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      <form action={salir} className="lg:hidden">
        <Button variant="outline" className="mt-6 w-full">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
