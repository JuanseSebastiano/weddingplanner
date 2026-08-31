"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  formatFecha,
  formatMonto,
  RUBRO_LABEL,
  type Rubro,
} from "@/lib/format";
import { enAmbas } from "@/lib/plata";

export type QuoteConVendor = {
  id: string;
  monto: number;
  moneda: "ARS" | "USD";
  incluye: string | null;
  excluye: string | null;
  valido_hasta: string | null;
  estado: "recibido" | "aceptado" | "rechazado" | "vencido";
  vendors: {
    id: string;
    nombre: string;
    rubro: Rubro;
    rating: number | null;
    estado: string;
  };
};

export function Comparador({
  quotes,
  cotizacion,
}: {
  quotes: QuoteConVendor[];
  cotizacion: number;
}) {
  const rubros = [...new Set(quotes.map((q) => q.vendors.rubro))].sort();
  const [rubro, setRubro] = useState<Rubro | "">(rubros[0] ?? "");

  const delRubro = quotes
    .filter((q) => q.vendors.rubro === rubro)
    .map((q) => ({ ...q, par: enAmbas(q.monto, q.moneda, cotizacion) }))
    .sort((a, b) => a.par.usd - b.par.usd);

  const masBarato = delRubro[0]?.par.usd;

  return (
    <main>
      <h1 className="text-2xl font-semibold">Comparador</h1>
      <p className="text-sm text-muted-foreground">
        Presupuestos del mismo rubro, lado a lado. Los montos se normalizan a
        dólares para poder compararlos.
      </p>

      {quotes.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Todavía no hay presupuestos cargados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá al menos dos del mismo rubro desde la ficha de cada{" "}
            <Link href="/proveedores" className="text-primary underline">
              proveedor
            </Link>{" "}
            y acá los vas a poder comparar.
          </p>
        </div>
      ) : (
        <>
          <Select
            value={rubro}
            onChange={(e) => setRubro(e.target.value as Rubro)}
            className="mt-3"
            aria-label="Rubro a comparar"
          >
            {rubros.map((r) => (
              <option key={r} value={r}>
                {RUBRO_LABEL[r]} (
                {quotes.filter((q) => q.vendors.rubro === r).length})
              </option>
            ))}
          </Select>

          {delRubro.length === 1 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Hay uno solo en este rubro. Cargá otro para poder comparar.
            </p>
          )}

          <div className="mt-3 overflow-x-auto">
            <div className="flex gap-3 pb-2">
              {delRubro.map((q) => (
                <article
                  key={q.id}
                  className="w-64 shrink-0 rounded-xl border border-border bg-card p-3"
                >
                  <Link
                    href={`/proveedores/${q.vendors.id}`}
                    className="font-medium underline"
                  >
                    {q.vendors.nombre}
                  </Link>

                  {q.vendors.rating && (
                    <p className="mt-0.5 flex items-center gap-0.5 text-sm text-muted-foreground">
                      {q.vendors.rating}
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    </p>
                  )}

                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {formatMonto(q.par.usd, "USD")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatMonto(q.par.ars, "ARS")}
                    {q.moneda === "ARS" && " (cotizado en pesos)"}
                  </p>

                  {q.par.usd === masBarato && delRubro.length > 1 && (
                    <p className="mt-1 text-sm font-medium text-success">
                      El más barato
                    </p>
                  )}
                  {q.par.usd !== masBarato && masBarato !== undefined && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      +{formatMonto(q.par.usd - masBarato, "USD")} vs el más
                      barato
                    </p>
                  )}

                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Incluye</dt>
                      <dd>{q.incluye ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">No incluye</dt>
                      <dd>{q.excluye ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Válido hasta</dt>
                      <dd>
                        {q.valido_hasta ? formatFecha(q.valido_hasta) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Estado</dt>
                      <dd>{q.estado}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
