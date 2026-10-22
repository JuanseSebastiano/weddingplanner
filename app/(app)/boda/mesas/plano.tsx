"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CARPA, dentroDeCarpa, lugarLibre, seSuperponen, sillas, type Pieza } from "@/lib/plano";
import { actualizarElemento, actualizarMesa, asignarAMesa, crearElementosBase } from "./actions";
import type { Invitado, Mesa } from "./mesas";

export type Elemento = {
  id: string;
  tipo: "pista" | "dj" | "otro";
  nombre: string;
  x: number;
  y: number;
  ancho: number;
  largo: number;
};

type Seleccion = { tipo: "mesa"; id: string } | { tipo: "elemento"; id: string } | null;
type Arrastre = { tipo: "mesa" | "elemento"; id: string; dx: number; dy: number; movio: boolean };

const PADDING = 0.4;
const lugares = (lista: Invitado[]) => lista.reduce((n, i) => n + 1 + i.acompanantes, 0);

/** Plano a escala de la carpa: mesas, pista y DJ que se arrastran con el mouse o el dedo. */
export function Plano({
  mesas,
  invitados,
  elementos,
}: {
  mesas: Mesa[];
  invitados: Invitado[];
  elementos: Elemento[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [posiciones, setPosiciones] = useState<Record<string, { x: number; y: number }>>({});
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [, startTransition] = useTransition();

  // La primera vez se crean la pista y el DJ.
  useEffect(() => {
    if (elementos.length === 0) void crearElementosBase();
  }, [elementos.length]);

  // Cuando llegan datos nuevos del servidor, las posiciones locales sobran.
  const [datos, setDatos] = useState({ mesas, elementos });
  if (datos.mesas !== mesas || datos.elementos !== elementos) {
    setDatos({ mesas, elementos });
    setPosiciones({});
  }

  const ubicadas = mesas.filter((m) => m.x !== null && m.y !== null);
  const sinUbicar = mesas.filter((m) => m.x === null || m.y === null);

  const piezaMesa = (m: Mesa): Pieza => ({
    x: posiciones[m.id]?.x ?? m.x!,
    y: posiciones[m.id]?.y ?? m.y!,
    ancho: m.ancho,
    largo: m.forma === "redonda" ? m.ancho : m.largo,
    forma: m.forma,
  });
  const piezaElemento = (e: Elemento): Pieza => ({
    x: posiciones[e.id]?.x ?? e.x,
    y: posiciones[e.id]?.y ?? e.y,
    ancho: e.ancho,
    largo: e.largo,
    forma: "rectangular",
  });

  const todas = [
    ...ubicadas.map((m) => ({ id: m.id, pieza: piezaMesa(m) })),
    ...elementos.map((e) => ({ id: e.id, pieza: piezaElemento(e) })),
  ];
  const choca = (id: string, p: Pieza) => todas.some((o) => o.id !== id && seSuperponen(p, o.pieza));

  function aMetros(e: React.PointerEvent) {
    const ctm = svgRef.current!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm);
    return { x: pt.x, y: pt.y };
  }

  function empezar(e: React.PointerEvent, tipo: "mesa" | "elemento", id: string, p: Pieza) {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    const m = aMetros(e);
    setArrastre({ tipo, id, dx: m.x - p.x, dy: m.y - p.y, movio: false });
  }

  function mover(e: React.PointerEvent) {
    if (!arrastre) return;
    const m = aMetros(e);
    const actual = todas.find((t) => t.id === arrastre.id)!.pieza;
    const nueva = dentroDeCarpa({ ...actual, x: m.x - arrastre.dx, y: m.y - arrastre.dy });
    if (!arrastre.movio && Math.hypot(nueva.x - actual.x, nueva.y - actual.y) < 0.15) return;
    setArrastre({ ...arrastre, movio: true });
    setPosiciones((p) => ({ ...p, [arrastre.id]: nueva }));
  }

  function soltar() {
    if (!arrastre) return;
    const { tipo, id, movio } = arrastre;
    setArrastre(null);
    if (!movio) {
      setSeleccion({ tipo, id });
      return;
    }
    const pos = posiciones[id];
    if (!pos) return;
    startTransition(async () => {
      if (tipo === "mesa") await actualizarMesa(id, pos);
      else await actualizarElemento(id, pos);
    });
  }

  function ubicar(m: Mesa) {
    const forma = { ancho: m.ancho, largo: m.forma === "redonda" ? m.ancho : m.largo, forma: m.forma };
    const lugar = lugarLibre(forma, todas.map((t) => t.pieza));
    if (!lugar) {
      alert("No queda lugar libre en la carpa para esta mesa.");
      return;
    }
    startTransition(async () => {
      await actualizarMesa(m.id, lugar);
    });
  }

  const mesaSel = seleccion?.tipo === "mesa" ? mesas.find((m) => m.id === seleccion.id) : undefined;
  const elementoSel = seleccion?.tipo === "elemento" ? elementos.find((e) => e.id === seleccion.id) : undefined;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Carpa {CARPA.ancho}×{CARPA.largo} m · cada cuadro es 1 m. Arrastrá para mover; tocá para editar.
        </p>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" aria-label="Ajustar" onClick={() => setZoom(1)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-h-[75dvh] overflow-auto rounded-2xl border border-border bg-card">
        <svg
          ref={svgRef}
          viewBox={`${-PADDING} ${-PADDING} ${CARPA.ancho + PADDING * 2} ${CARPA.largo + PADDING * 2}`}
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 520 : undefined }}
          className="mx-auto block select-none"
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={() => setArrastre(null)}
        >
          <rect x={0} y={0} width={CARPA.ancho} height={CARPA.largo} className="fill-subtle stroke-border" strokeWidth={0.05} />
          {Array.from({ length: CARPA.ancho - 1 }, (_, i) => (
            <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={CARPA.largo} className="stroke-border-soft" strokeWidth={0.02} />
          ))}
          {Array.from({ length: CARPA.largo - 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i + 1} x2={CARPA.ancho} y2={i + 1} className="stroke-border-soft" strokeWidth={0.02} />
          ))}

          {elementos.map((e) => {
            const p = piezaElemento(e);
            const mal = choca(e.id, p);
            return (
              <g
                key={e.id}
                style={{ touchAction: "none", cursor: "grab" }}
                onPointerDown={(ev) => empezar(ev, "elemento", e.id, p)}
              >
                <rect
                  x={p.x - p.ancho / 2}
                  y={p.y - p.largo / 2}
                  width={p.ancho}
                  height={p.largo}
                  rx={0.1}
                  className={cn(e.tipo === "pista" ? "fill-sage-soft" : "fill-primary-soft", mal ? "stroke-danger" : "stroke-sage")}
                  strokeWidth={0.05}
                />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={0.4} className="fill-foreground">
                  {e.nombre}
                </text>
                <text x={p.x} y={p.y + 0.45} textAnchor="middle" fontSize={0.25} className="fill-muted-foreground">
                  {e.ancho}×{e.largo} m
                </text>
              </g>
            );
          })}

          {ubicadas.map((m) => {
            const p = piezaMesa(m);
            const ocupados = lugares(invitados.filter((i) => i.table_id === m.id));
            const mal = choca(m.id, p) || ocupados > m.capacidad;
            return (
              <g
                key={m.id}
                style={{ touchAction: "none", cursor: "grab" }}
                onPointerDown={(ev) => empezar(ev, "mesa", m.id, p)}
              >
                {sillas(p, m.capacidad).map((s, i) => (
                  <circle
                    key={i}
                    cx={p.x + s.x}
                    cy={p.y + s.y}
                    r={0.17}
                    className={i < ocupados ? "fill-primary" : "fill-card stroke-border"}
                    strokeWidth={0.03}
                  />
                ))}
                {m.forma === "redonda" ? (
                  <circle cx={p.x} cy={p.y} r={p.ancho / 2} className={cn("fill-card", mal ? "stroke-danger" : "stroke-primary")} strokeWidth={0.06} />
                ) : (
                  <rect
                    x={p.x - p.ancho / 2}
                    y={p.y - p.largo / 2}
                    width={p.ancho}
                    height={p.largo}
                    rx={0.08}
                    className={cn("fill-card", mal ? "stroke-danger" : "stroke-primary")}
                    strokeWidth={0.06}
                  />
                )}
                <text x={p.x} y={p.y - 0.05} textAnchor="middle" fontSize={0.38} className="fill-foreground font-serif">
                  {m.numero}
                </text>
                <text x={p.x} y={p.y + 0.32} textAnchor="middle" fontSize={0.24} className={mal ? "fill-danger" : "fill-muted-foreground"}>
                  {ocupados}/{m.capacidad}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {sinUbicar.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Mesas sin ubicar en el plano</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sinUbicar.map((m) => (
              <Button key={m.id} variant="outline" size="sm" onClick={() => ubicar(m)}>
                Ubicar mesa {m.numero}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Sheet open={seleccion !== null} onOpenChange={(abierto) => !abierto && setSeleccion(null)}>
        {mesaSel && (
          <SheetContent title={`Mesa ${mesaSel.numero}`}>
            <PanelMesa key={mesaSel.id} mesa={mesaSel} invitados={invitados} />
          </SheetContent>
        )}
        {elementoSel && (
          <SheetContent title={elementoSel.nombre}>
            <PanelElemento key={elementoSel.id} elemento={elementoSel} onListo={() => setSeleccion(null)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function PanelMesa({ mesa, invitados }: { mesa: Mesa; invitados: Invitado[] }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forma, setForma] = useState(mesa.forma);
  const [agregar, setAgregar] = useState("");
  const enMesa = invitados.filter((i) => i.table_id === mesa.id);
  const sinMesa = invitados.filter((i) => !i.table_id && i.rsvp !== "rechazado");

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ancho = Number(f.get("ancho"));
    const campos = {
      forma,
      ancho,
      largo: forma === "redonda" ? ancho : Number(f.get("largo")),
      capacidad: Number(f.get("capacidad")),
    };
    startTransition(async () => {
      const r = await actualizarMesa(mesa.id, campos);
      setError(r.error ?? null);
    });
  }

  function asignar(ids: string[], tableId: string | null) {
    startTransition(async () => {
      const r = await asignarAMesa(ids, tableId);
      setError(r.error ?? null);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={guardar} className="space-y-3">
        <div className="inline-flex rounded-xl border border-border p-1 text-sm">
          {(["redonda", "rectangular"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForma(f)}
              className={cn("rounded-lg px-3 py-1", forma === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {f === "redonda" ? "Redonda" : "Rectangular"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ancho">{forma === "redonda" ? "Diámetro (m)" : "Largo (m)"}</Label>
            <Input id="ancho" name="ancho" type="number" step="0.1" min={0.5} max={10} defaultValue={mesa.ancho} className="mt-1" required />
          </div>
          {forma === "rectangular" && (
            <div>
              <Label htmlFor="largo">Ancho (m)</Label>
              <Input id="largo" name="largo" type="number" step="0.1" min={0.5} max={15} defaultValue={mesa.forma === "rectangular" ? mesa.largo : 0.9} className="mt-1" required />
            </div>
          )}
          <div>
            <Label htmlFor="capacidad">Lugares</Label>
            <Input id="capacidad" name="capacidad" type="number" min={1} defaultValue={mesa.capacidad} className="mt-1" required />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar medidas"}
        </Button>
      </form>

      <div>
        <p className="text-sm font-medium">
          Invitados ({lugares(enMesa)} de {mesa.capacidad})
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {enMesa.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => asignar([i.id], null)}
                disabled={pendiente}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-sm"
                title="Sacar de la mesa"
              >
                {i.nombre}
                {i.acompanantes > 0 && ` +${i.acompanantes}`} ✕
              </button>
            </li>
          ))}
          {enMesa.length === 0 && <li className="text-sm text-muted-foreground">Todavía nadie.</li>}
        </ul>
        {sinMesa.length > 0 && (
          <div className="mt-3 flex gap-2">
            <select
              className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm"
              value={agregar}
              onChange={(e) => setAgregar(e.target.value)}
            >
              <option value="">Sumar invitado sin mesa…</option>
              {sinMesa.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                  {i.acompanantes > 0 ? ` +${i.acompanantes}` : ""}
                  {i.grupo ? ` · ${i.grupo}` : ""}
                </option>
              ))}
            </select>
            <Button
              disabled={!agregar || pendiente}
              onClick={() => {
                asignar([agregar], mesa.id);
                setAgregar("");
              }}
            >
              Sumar
            </Button>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        className="w-full"
        disabled={pendiente}
        onClick={() => startTransition(async () => void (await actualizarMesa(mesa.id, { x: null, y: null })))}
      >
        Sacar del plano
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function PanelElemento({ elemento, onListo }: { elemento: Elemento; onListo: () => void }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await actualizarElemento(elemento.id, {
        nombre: String(f.get("nombre")).trim() || elemento.nombre,
        ancho: Number(f.get("ancho")),
        largo: Number(f.get("largo")),
      });
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" defaultValue={elemento.nombre} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ancho">Ancho (m)</Label>
          <Input id="ancho" name="ancho" type="number" step="0.1" min={0.5} max={CARPA.ancho} defaultValue={elemento.ancho} className="mt-1" required />
        </div>
        <div>
          <Label htmlFor="largo">Largo (m)</Label>
          <Input id="largo" name="largo" type="number" step="0.1" min={0.5} max={CARPA.largo} defaultValue={elemento.largo} className="mt-1" required />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
