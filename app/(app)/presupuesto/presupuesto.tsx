"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, AlertTriangle, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatMonto, RUBROS, RUBRO_LABEL, type Rubro } from "@/lib/format";
import {
  agruparPorCategoria,
  gastoAcumulado,
  sumar,
  CERO,
  type Item,
  type Pago,
} from "@/lib/plata";
import {
  crearItem,
  actualizarItem,
  borrarItem,
  guardarCotizacionReferencia,
} from "./actions";
import { CurvaGasto } from "./curva-gasto";

export function Presupuesto({
  objetivo,
  monedaBase,
  cotizacion,
  items,
  pagos,
  vendors,
}: {
  objetivo: number;
  monedaBase: "ARS" | "USD";
  cotizacion: number;
  items: Item[];
  pagos: Pago[];
  vendors: { id: string; nombre: string }[];
}) {
  const [editando, setEditando] = useState<Item | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [abierta, setAbierta] = useState<Rubro | null>(null);

  const categorias = agruparPorCategoria(items, pagos, cotizacion);
  const serie = gastoAcumulado(pagos, cotizacion);

  const totalPrevisto = categorias.reduce((a, c) => sumar(a, c.previsto), CERO);
  const totalPagado = categorias.reduce((a, c) => sumar(a, c.pagado), CERO);
  const totalPendiente = categorias.reduce(
    (a, c) => sumar(a, c.pendiente),
    CERO,
  );

  const objetivoUSD = monedaBase === "USD" ? objetivo : objetivo / cotizacion;
  const usado = objetivoUSD > 0 ? totalPagado.usd / objetivoUSD : 0;
  const sePasaDelObjetivo = totalPrevisto.usd > objetivoUSD;
  const maxCategoria = Math.max(1, ...categorias.map((c) => c.previsto.usd));

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal lg:text-[28px]">
          Presupuesto
        </h1>
        <Sheet open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Ítem
            </Button>
          </SheetTrigger>
          <SheetContent title="Nuevo ítem de presupuesto">
            <FormItem
              vendors={vendors}
              onListo={() => setNuevoAbierto(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <Card className="mt-3">
        <p className="text-sm text-muted-foreground">Pagado</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatMonto(totalPagado.usd, "USD")}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatMonto(totalPagado.ars, "ARS")} · objetivo{" "}
          {formatMonto(objetivoUSD, "USD")}
        </p>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-data"
            style={{ width: `${Math.min(100, usado * 100)}%` }}
          />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-[11px] text-muted-foreground">Previsto</dt>
            <dd className="font-medium tabular-nums">
              {formatMonto(totalPrevisto.usd, "USD")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Falta pagar</dt>
            <dd className="font-medium tabular-nums">
              {formatMonto(totalPendiente.usd, "USD")}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Del objetivo</dt>
            <dd className="font-medium tabular-nums">
              {Math.round(usado * 100)}%
            </dd>
          </div>
        </dl>

        {sePasaDelObjetivo && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-danger-soft p-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Lo previsto supera el objetivo por{" "}
            {formatMonto(totalPrevisto.usd - objetivoUSD, "USD")}.
          </p>
        )}
      </Card>

      <CotizacionReferencia valor={cotizacion} />

      {serie.length > 1 && (
        <section className="mt-4">
          <h2 className="font-serif text-lg font-normal">Gasto acumulado</h2>
          <p className="text-sm text-muted-foreground">
            Total pagado a lo largo del tiempo, en dólares.
          </p>
          <CurvaGasto datos={serie} objetivo={objetivoUSD} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-serif text-lg font-normal">Por categoría</h2>

        {categorias.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-serif text-lg font-normal">
              Todavía no hay ítems cargados
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Agregá el primero con el botón “Ítem”: por ejemplo salón, catering
              o fotografía, con lo que estiman gastar.
            </p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {categorias.map((c) => (
              <li
                key={c.categoria}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <button
                  onClick={() =>
                    setAbierta(abierta === c.categoria ? null : c.categoria)
                  }
                  className="w-full p-3 text-left active:bg-muted"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {RUBRO_LABEL[c.categoria]}
                    </span>
                    <span className="tabular-nums">
                      {formatMonto(c.previsto.usd, "USD")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        abierta === c.categoria && "rotate-180",
                      )}
                    />
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-data"
                      style={{
                        width: `${(c.previsto.usd / maxCategoria) * 100}%`,
                      }}
                    />
                  </div>

                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Pagado {formatMonto(c.pagado.usd, "USD")} · falta{" "}
                    {formatMonto(c.pendiente.usd, "USD")}
                  </p>

                  {c.excedido && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-danger">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Se pasó{" "}
                      {formatMonto(c.previsto.usd - c.estimado.usd, "USD")} de
                      lo estimado
                    </p>
                  )}
                </button>

                {abierta === c.categoria && (
                  <ul className="divide-y divide-border-soft border-t border-border">
                    {c.items.map(({ item, previsto, pagado, excedido }) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 py-2.5 pl-3 pr-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{item.concepto}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatMonto(
                              item.monto_real ?? item.monto_estimado,
                              item.moneda,
                            )}{" "}
                            · pagado {formatMonto(pagado.usd, "USD")}
                            {excedido && (
                              <span className="text-danger">
                                {" "}
                                · se pasó del estimado
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                          {formatMonto(previsto.usd, "USD")}
                        </span>
                        <button
                          onClick={() => setEditando(item)}
                          aria-label={`Editar ${item.concepto}`}
                          className="shrink-0 rounded-lg p-2 hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/pagos"
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card shadow-card p-4"
      >
        <span>
          <span className="font-serif text-lg font-normal">
            Pagos y vencimientos
          </span>
          <span className="block text-sm text-muted-foreground">
            {pagos.length} movimientos cargados
          </span>
        </span>
        <ChevronDown className="h-5 w-5 -rotate-90 text-muted-foreground" />
      </Link>

      <Sheet
        open={editando !== null}
        onOpenChange={(a) => !a && setEditando(null)}
      >
        {editando && (
          <SheetContent title={editando.concepto}>
            <FormItem
              item={editando}
              vendors={vendors}
              onListo={() => setEditando(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

/** Se edita en el lugar: es el número que más cambia. */
function CotizacionReferencia({ valor }: { valor: number }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <label className="mt-2 flex items-center gap-2 px-1 text-sm text-muted-foreground">
      Cotización de referencia: 1 USD =
      <Input
        type="number"
        min={1}
        step="0.01"
        inputMode="decimal"
        defaultValue={valor}
        disabled={pendiente}
        aria-label="Cotización de referencia en pesos por dólar"
        onBlur={(e) => {
          const nueva = Number(e.target.value);
          if (!nueva || nueva === valor) return;
          startTransition(async () => {
            await guardarCotizacionReferencia(nueva);
          });
        }}
        className="h-9 w-28 text-sm"
      />
      ARS
    </label>
  );
}

function FormItem({
  item,
  vendors,
  onListo,
}: {
  item?: Item;
  vendors: { id: string; nombre: string }[];
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const real = String(f.get("monto_real") ?? "").trim();

    const datos = {
      categoria: f.get("categoria") as Rubro,
      concepto: String(f.get("concepto") ?? "").trim(),
      monto_estimado: Number(f.get("monto_estimado") ?? 0),
      monto_real: real === "" ? null : Number(real),
      moneda: f.get("moneda") as "ARS" | "USD",
      vendor_id: (String(f.get("vendor_id") ?? "") || null) as string | null,
    };

    startTransition(async () => {
      const r = item
        ? await actualizarItem(item.id, datos)
        : await crearItem(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="concepto">Concepto</Label>
        <Input
          id="concepto"
          name="concepto"
          required
          autoFocus={!item}
          defaultValue={item?.concepto}
          placeholder="Ej: Salón + catering"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="categoria">Categoría</Label>
        <Select
          id="categoria"
          name="categoria"
          defaultValue={item?.categoria ?? "otros"}
          className="mt-1"
        >
          {RUBROS.map((r) => (
            <option key={r} value={r}>
              {RUBRO_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="monto_estimado">Estimado</Label>
          <Input
            id="monto_estimado"
            name="monto_estimado"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={item?.monto_estimado ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="moneda">Moneda</Label>
          <Select
            id="moneda"
            name="moneda"
            defaultValue={item?.moneda ?? "ARS"}
            className="mt-1"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="monto_real">Real (cuando lo sepan)</Label>
        <Input
          id="monto_real"
          name="monto_real"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          defaultValue={item?.monto_real ?? ""}
          placeholder="Vacío = usamos el estimado"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="vendor_id">Proveedor</Label>
        <Select
          id="vendor_id"
          name="vendor_id"
          defaultValue={item?.vendor_id ?? ""}
          className="mt-1"
        >
          <option value="">Sin proveedor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : item ? "Guardar" : "Agregar ítem"}
      </Button>

      {item && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar "${item.concepto}" y sus pagos?`)) return;
            startTransition(async () => {
              const r = await borrarItem(item.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar ítem
        </Button>
      )}
    </form>
  );
}
