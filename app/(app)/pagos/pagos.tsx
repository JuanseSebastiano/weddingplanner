"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, AlertTriangle, Paperclip, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatFecha, formatMonto, hoyISO } from "@/lib/format";
import { pagoEnAmbas, type Item, type Pago } from "@/lib/plata";
import {
  crearPago,
  actualizarPago,
  borrarPago,
  subirComprobante,
  urlDeArchivo,
} from "../presupuesto/actions";

const TIPO_LABEL = { sena: "Seña", cuota: "Cuota", saldo: "Saldo" } as const;

export function Pagos({
  pagos,
  items,
  cotizacion,
}: {
  pagos: Pago[];
  items: Item[];
  cotizacion: number;
}) {
  const [editando, setEditando] = useState<Pago | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const hoy = hoyISO();
  const en30 = new Date(new Date(hoy).getTime() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const proximos = pagos
    .filter((p) => !p.pagado && p.fecha <= en30)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const concepto = (id: string) =>
    items.find((i) => i.id === id)?.concepto ?? "Ítem borrado";

  // Los pagos vienen ordenados por fecha descendente; se agrupan por mes.
  const porMes = new Map<string, Pago[]>();
  for (const p of pagos) {
    const mes = p.fecha.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), p]);
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pagos</h1>
        <Sheet open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
          <SheetTrigger asChild>
            <Button size="sm" disabled={items.length === 0}>
              <Plus className="h-4 w-4" /> Pago
            </Button>
          </SheetTrigger>
          <SheetContent title="Nuevo pago">
            <FormPago
              items={items}
              cotizacion={cotizacion}
              onListo={() => setNuevoAbierto(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {proximos.length > 0 && (
        <section className="mt-3 rounded-xl border border-warning bg-warning/10 p-3">
          <h2 className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {proximos.length === 1
              ? "1 pago por vencer"
              : `${proximos.length} pagos por vencer`}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {proximos.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="truncate">
                  {concepto(p.budget_item_id)}
                  {p.fecha < hoy && (
                    <span className="font-medium text-danger"> · vencido</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMonto(p.monto, p.moneda)} · {formatFecha(p.fecha)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Primero cargá ítems de presupuesto</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada pago se imputa a un ítem (salón, catering…). Creá uno en
            Presupuesto y volvé acá.
          </p>
        </div>
      ) : pagos.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Todavía no hay pagos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá las señas y cuotas que ya hicieron, y también las que vienen:
            si las dejás sin marcar como pagadas, aparecen como vencimientos.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {[...porMes.entries()].map(([mes, delMes]) => (
            <section key={mes}>
              <h2 className="text-sm font-medium text-muted-foreground">
                {formatFecha(`${mes}-01`).slice(3)}
              </h2>
              <ul className="mt-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {delMes.map((p) => {
                  const par = pagoEnAmbas(p, cotizacion);
                  return (
                    <li key={p.id} className="flex items-center gap-2 pr-2">
                      <button
                        onClick={() => setEditando(p)}
                        className="min-w-0 flex-1 px-3 py-3 text-left active:bg-muted"
                      >
                        <p className="truncate font-medium">
                          {concepto(p.budget_item_id)}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {formatFecha(p.fecha)} · {TIPO_LABEL[p.tipo]}
                          {p.medio_pago && ` · ${p.medio_pago}`}
                          {p.comprobante_path && " · con comprobante"}
                        </p>
                      </button>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums">
                          {formatMonto(p.monto, p.moneda)}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {p.moneda === "USD"
                            ? formatMonto(par.ars, "ARS")
                            : formatMonto(par.usd, "USD")}
                        </p>
                      </div>
                      <TogglePagado pago={p} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Sheet
        open={editando !== null}
        onOpenChange={(a) => !a && setEditando(null)}
      >
        {editando && (
          <SheetContent title={concepto(editando.budget_item_id)}>
            <FormPago
              pago={editando}
              items={items}
              cotizacion={cotizacion}
              onListo={() => setEditando(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

/** Se marca al instante; useOptimistic revierte solo si el guardado falla. */
function TogglePagado({ pago }: { pago: Pago }) {
  const [pagado, setPagado] = useOptimistic(pago.pagado);
  const [, startTransition] = useTransition();

  return (
    <button
      aria-label={pagado ? "Marcar como pendiente" : "Marcar como pagado"}
      onClick={() =>
        startTransition(async () => {
          setPagado(!pagado);
          await actualizarPago(pago.id, { pagado: !pagado });
        })
      }
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
        pagado
          ? "border-success bg-success/15 text-success"
          : "border-border text-muted-foreground",
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function FormPago({
  pago,
  items,
  cotizacion,
  onListo,
}: {
  pago?: Pago;
  items: Item[];
  cotizacion: number;
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<"ARS" | "USD">(pago?.moneda ?? "ARS");

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cot = String(f.get("cotizacion_usd") ?? "").trim();

    const datos = {
      budget_item_id: String(f.get("budget_item_id")),
      monto: Number(f.get("monto")),
      moneda: f.get("moneda") as "ARS" | "USD",
      cotizacion_usd: cot === "" ? null : Number(cot),
      fecha: String(f.get("fecha")),
      medio_pago: (String(f.get("medio_pago") ?? "").trim() || null) as
        | string
        | null,
      tipo: f.get("tipo") as "sena" | "cuota" | "saldo",
      pagado: f.get("pagado") === "on",
    };

    if (datos.moneda === "USD" && !datos.cotizacion_usd) {
      setError("Para un pago en dólares hace falta la cotización usada.");
      return;
    }

    startTransition(async () => {
      const r = pago
        ? await actualizarPago(pago.id, datos)
        : await crearPago(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="budget_item_id">Ítem</Label>
        <Select
          id="budget_item_id"
          name="budget_item_id"
          required
          defaultValue={pago?.budget_item_id ?? ""}
          disabled={!!pago}
          className="mt-1"
        >
          <option value="" disabled>
            Elegí un ítem
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.concepto}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="monto">Monto</Label>
          <Input
            id="monto"
            name="monto"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            autoFocus={!pago}
            defaultValue={pago?.monto ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="moneda">Moneda</Label>
          <Select
            id="moneda"
            name="moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")}
            className="mt-1"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="cotizacion_usd">
          Cotización usada {moneda === "USD" ? "(obligatoria)" : "(opcional)"}
        </Label>
        <Input
          id="cotizacion_usd"
          name="cotizacion_usd"
          type="number"
          min={1}
          step="0.01"
          inputMode="decimal"
          required={moneda === "USD"}
          defaultValue={
            pago?.cotizacion_usd ?? (moneda === "USD" ? cotizacion : "")
          }
          placeholder={`Pesos por dólar (referencia: ${cotizacion})`}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            required
            defaultValue={pago?.fecha ?? hoyISO()}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            id="tipo"
            name="tipo"
            defaultValue={pago?.tipo ?? "cuota"}
            className="mt-1"
          >
            <option value="sena">Seña</option>
            <option value="cuota">Cuota</option>
            <option value="saldo">Saldo</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="medio_pago">Medio de pago</Label>
        <Input
          id="medio_pago"
          name="medio_pago"
          defaultValue={pago?.medio_pago ?? ""}
          placeholder="Ej: transferencia, efectivo"
          className="mt-1"
        />
      </div>

      <label className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          name="pagado"
          defaultChecked={pago ? pago.pagado : true}
          className="h-5 w-5 rounded border-input"
        />
        <span className="text-sm">
          Ya está pagado (si no, queda como vencimiento)
        </span>
      </label>

      {pago && <Comprobante pago={pago} />}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : pago ? "Guardar" : "Agregar pago"}
      </Button>

      {pago && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm("¿Borrar este pago?")) return;
            startTransition(async () => {
              const r = await borrarPago(pago.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar pago
        </Button>
      )}
    </form>
  );
}

function Comprobante({ pago }: { pago: Pago }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Comprobante</p>

      {pago.comprobante_path && (
        <button
          type="button"
          className="mt-1 flex items-center gap-1.5 text-sm text-primary underline"
          onClick={() =>
            startTransition(async () => {
              const r = await urlDeArchivo(pago.comprobante_path!);
              if (r.error) setError(r.error);
              else window.open(r.url, "_blank");
            })
          }
        >
          <Paperclip className="h-4 w-4" /> Ver el archivo cargado
        </button>
      )}

      <input
        type="file"
        accept="image/*,application/pdf"
        disabled={pendiente}
        className="mt-2 block w-full text-sm"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          startTransition(async () => {
            const r = await subirComprobante(pago.id, archivo);
            if (r.error) setError(r.error);
          });
        }}
      />

      {pendiente && (
        <p className="mt-1 text-sm text-muted-foreground">Subiendo…</p>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
