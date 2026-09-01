"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Star,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatFecha, formatMonto, RUBRO_LABEL } from "@/lib/format";
import { enAmbas } from "@/lib/plata";
import { urlDeArchivo } from "../../presupuesto/actions";
import { FormVendor, type Vendor } from "../form-vendor";
import {
  crearQuote,
  actualizarQuote,
  borrarQuote,
  subirArchivoQuote,
  type DatosQuote,
} from "../actions";

export type Quote = DatosQuote & { id: string; archivo_path: string | null };

const ESTADO_VENDOR = {
  contactado: "Contactado",
  presupuesto_recibido: "Presupuesto recibido",
  contratado: "Contratado",
  descartado: "Descartado",
} as const;

const ESTADO_QUOTE = {
  recibido: "Recibido",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  vencido: "Vencido",
} as const;

export function FichaVendor({
  vendor,
  quotes,
  tareas,
  items,
  cotizacion,
}: {
  vendor: Vendor;
  quotes: Quote[];
  tareas: {
    id: string;
    titulo: string;
    estado: string;
    fecha_limite: string | null;
  }[];
  items: {
    id: string;
    concepto: string;
    monto_estimado: number;
    monto_real: number | null;
    moneda: "ARS" | "USD";
  }[];
  cotizacion: number;
}) {
  const [editandoVendor, setEditandoVendor] = useState(false);
  const [editandoQuote, setEditandoQuote] = useState<Quote | null>(null);
  const [nuevoQuote, setNuevoQuote] = useState(false);

  return (
    <main>
      <Link
        href="/proveedores"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Proveedores
      </Link>

      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-normal lg:text-[28px]">
            {vendor.nombre}
          </h1>
          <p className="text-muted-foreground">
            {RUBRO_LABEL[vendor.rubro]} · {ESTADO_VENDOR[vendor.estado]}
          </p>
        </div>
        <Sheet open={editandoVendor} onOpenChange={setEditandoVendor}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Editar proveedor">
              <Pencil className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent title={`Editar ${vendor.nombre}`}>
            <FormVendor
              vendor={vendor}
              onListo={() => setEditandoVendor(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {vendor.rating && (
        <p className="mt-1 flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={
                i < vendor.rating!
                  ? "h-4 w-4 fill-warning text-warning"
                  : "h-4 w-4 text-border"
              }
            />
          ))}
          <span className="ml-1 text-sm text-muted-foreground">
            {vendor.rating} de 5
          </span>
        </p>
      )}

      {(vendor.contacto || vendor.telefono || vendor.web_ig) && (
        <Card className="mt-3 space-y-1 text-sm">
          {vendor.contacto && <p>{vendor.contacto}</p>}
          {vendor.telefono && (
            <p>
              <a
                href={`tel:${vendor.telefono}`}
                className="text-primary underline"
              >
                {vendor.telefono}
              </a>
            </p>
          )}
          {vendor.web_ig && (
            <p className="flex items-center gap-1">
              {vendor.web_ig.startsWith("http") ? (
                <a
                  href={vendor.web_ig}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary underline"
                >
                  {vendor.web_ig} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                vendor.web_ig
              )}
            </p>
          )}
        </Card>
      )}

      {vendor.notas && (
        <section className="mt-3">
          <h2 className="font-serif text-lg font-normal">Historial y notas</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {vendor.notas}
          </p>
        </section>
      )}

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-normal">Presupuestos</h2>
          <Sheet open={nuevoQuote} onOpenChange={setNuevoQuote}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Presupuesto
              </Button>
            </SheetTrigger>
            <SheetContent title="Nuevo presupuesto">
              <FormQuote
                vendorId={vendor.id}
                onListo={() => setNuevoQuote(false)}
              />
            </SheetContent>
          </Sheet>
        </div>

        {quotes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no cargaron ninguno. Cuando les pasen uno, guardalo acá con
            lo que incluye y lo que no, así después los comparan.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {quotes.map((q) => {
              const par = enAmbas(q.monto, q.moneda, cotizacion);
              return (
                <li
                  key={q.id}
                  className="rounded-2xl border border-border bg-card shadow-card p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatMonto(q.monto, q.moneda)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {q.moneda === "USD"
                          ? formatMonto(par.ars, "ARS")
                          : formatMonto(par.usd, "USD")}{" "}
                        · {ESTADO_QUOTE[q.estado]}
                        {q.valido_hasta &&
                          ` · vale hasta ${formatFecha(q.valido_hasta)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditandoQuote(q)}
                      aria-label="Editar presupuesto"
                      className="rounded-lg p-2 hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>

                  {q.incluye && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Incluye: </span>
                      {q.incluye}
                    </p>
                  )}
                  {q.excluye && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        No incluye:{" "}
                      </span>
                      {q.excluye}
                    </p>
                  )}
                  {q.archivo_path && <VerArchivo path={q.archivo_path} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {items.length > 0 && (
        <section className="mt-5">
          <h2 className="font-serif text-lg font-normal">En el presupuesto</h2>
          <ul className="mt-1 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 px-3 py-2.5">
                <span className="truncate">{i.concepto}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatMonto(i.monto_real ?? i.monto_estimado, i.moneda)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tareas.length > 0 && (
        <section className="mt-5">
          <h2 className="font-serif text-lg font-normal">
            Tareas relacionadas
          </h2>
          <ul className="mt-1 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {tareas.map((t) => (
              <li key={t.id} className="flex justify-between gap-2 px-3 py-2.5">
                <span className="truncate">{t.titulo}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {t.estado === "hecha"
                    ? "hecha"
                    : t.fecha_limite
                      ? formatFecha(t.fecha_limite)
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={editandoQuote !== null}
        onOpenChange={(a) => !a && setEditandoQuote(null)}
      >
        {editandoQuote && (
          <SheetContent title="Editar presupuesto">
            <FormQuote
              quote={editandoQuote}
              vendorId={vendor.id}
              onListo={() => setEditandoQuote(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function VerArchivo({ path }: { path: string }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      className="mt-2 flex items-center gap-1.5 text-sm text-primary underline"
      onClick={() =>
        startTransition(async () => {
          const r = await urlDeArchivo(path);
          if (r.url) window.open(r.url, "_blank");
        })
      }
    >
      <Paperclip className="h-4 w-4" />
      {pendiente ? "Abriendo…" : "Ver el archivo"}
    </button>
  );
}

function FormQuote({
  quote,
  vendorId,
  onListo,
}: {
  quote?: Quote;
  vendorId: string;
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    const datos: DatosQuote = {
      vendor_id: vendorId,
      monto: Number(f.get("monto")),
      moneda: f.get("moneda") as "ARS" | "USD",
      incluye: (String(f.get("incluye") ?? "").trim() || null) as string | null,
      excluye: (String(f.get("excluye") ?? "").trim() || null) as string | null,
      valido_hasta: (String(f.get("valido_hasta") ?? "") || null) as
        | string
        | null,
      estado: f.get("estado") as DatosQuote["estado"],
    };

    startTransition(async () => {
      const r = quote
        ? await actualizarQuote(quote.id, vendorId, datos)
        : await crearQuote(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
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
            autoFocus={!quote}
            defaultValue={quote?.monto ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="moneda">Moneda</Label>
          <Select
            id="moneda"
            name="moneda"
            defaultValue={quote?.moneda ?? "ARS"}
            className="mt-1"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="incluye">Qué incluye</Label>
        <Textarea
          id="incluye"
          name="incluye"
          defaultValue={quote?.incluye ?? ""}
          placeholder="Ej: 8 horas, dos fotógrafos, álbum"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="excluye">Qué no incluye</Label>
        <Textarea
          id="excluye"
          name="excluye"
          defaultValue={quote?.excluye ?? ""}
          placeholder="Ej: viáticos, horas extra"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="valido_hasta">Válido hasta</Label>
          <Input
            id="valido_hasta"
            name="valido_hasta"
            type="date"
            defaultValue={quote?.valido_hasta ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Select
            id="estado"
            name="estado"
            defaultValue={quote?.estado ?? "recibido"}
            className="mt-1"
          >
            <option value="recibido">Recibido</option>
            <option value="aceptado">Aceptado</option>
            <option value="rechazado">Rechazado</option>
            <option value="vencido">Vencido</option>
          </Select>
        </div>
      </div>

      {quote && <ArchivoQuote quote={quote} vendorId={vendorId} />}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : quote ? "Guardar" : "Agregar presupuesto"}
      </Button>

      {quote && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm("¿Borrar este presupuesto?")) return;
            startTransition(async () => {
              const r = await borrarQuote(quote.id, vendorId);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar presupuesto
        </Button>
      )}
    </form>
  );
}

function ArchivoQuote({ quote, vendorId }: { quote: Quote; vendorId: string }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Archivo adjunto</p>
      {quote.archivo_path && <VerArchivo path={quote.archivo_path} />}
      <input
        type="file"
        accept="image/*,application/pdf"
        disabled={pendiente}
        className="mt-2 block w-full text-sm"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          startTransition(async () => {
            const r = await subirArchivoQuote(quote.id, vendorId, archivo);
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
