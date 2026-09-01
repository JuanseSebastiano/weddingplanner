import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/mesas", label: "Mesas" },
  { href: "/pagos", label: "Pagos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/comparador", label: "Comparador de presupuestos" },
  { href: "/ideas", label: "Ideas" },
  { href: "/agenda-del-dia", label: "Agenda del día" },
];

export default async function MasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function salir() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

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

      <p className="mt-6 text-sm text-muted-foreground">
        Sesión iniciada como {user?.email}
      </p>
      <form action={salir}>
        <Button variant="outline" className="mt-2 w-full">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}
