import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RUBRO_LABEL, type Rubro } from "@/lib/format";
import { ChevronRight, Star } from "lucide-react";
import { NuevoVendor } from "./nuevo-vendor";

const ESTADO_LABEL = {
  contactado: "Contactado",
  presupuesto_recibido: "Presupuesto recibido",
  contratado: "Contratado",
  descartado: "Descartado",
} as const;

export default async function ProveedoresPage() {
  const supabase = await createClient();

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, nombre, rubro, estado, rating, quotes(id)")
    .order("nombre");

  const lista = (vendors ?? []) as unknown as Array<{
    id: string;
    nombre: string;
    rubro: Rubro;
    estado: keyof typeof ESTADO_LABEL;
    rating: number | null;
    quotes: { id: string }[];
  }>;

  const rubros = [...new Set(lista.map((v) => v.rubro))];

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal lg:text-[28px]">
          Proveedores
        </h1>
        <NuevoVendor />
      </div>

      <Link
        href="/comparador"
        className="mt-3 block rounded-2xl border border-border bg-card shadow-card p-3"
      >
        <span className="font-serif text-lg font-normal">
          Comparar presupuestos
        </span>
        <span className="block text-sm text-muted-foreground">
          Lado a lado, dentro de un mismo rubro
        </span>
      </Link>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-serif text-lg font-normal">
            Todavía no hay proveedores
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá cada salón, fotógrafo o DJ con el que hablen, aunque sea sólo
            el nombre y el Instagram. Después les vas sumando los presupuestos.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {rubros.map((rubro) => (
            <section key={rubro}>
              <h2 className="text-sm font-medium text-muted-foreground">
                {RUBRO_LABEL[rubro]}
              </h2>
              <ul className="mt-1 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {lista
                  .filter((v) => v.rubro === rubro)
                  .map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/proveedores/${v.id}`}
                        className="flex items-center gap-2 px-3 py-3 active:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{v.nombre}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {ESTADO_LABEL[v.estado]}
                            {v.quotes.length > 0 &&
                              ` · ${v.quotes.length} presupuesto${v.quotes.length > 1 ? "s" : ""}`}
                          </p>
                        </div>
                        {v.rating && (
                          <span className="flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground">
                            {v.rating}
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
