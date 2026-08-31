"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Check, ListChecks, CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatFecha, hoyISO, RUBROS, RUBRO_LABEL, type Rubro } from "@/lib/format";
import {
  crearTarea,
  actualizarTarea,
  borrarTarea,
  sembrarChecklist,
  type DatosTarea,
} from "./actions";
import { CalendarioMensual } from "./calendario";

export type Tarea = DatosTarea & { id: string };

const PRIORIDAD_LABEL = { alta: "Alta", media: "Media", baja: "Baja" } as const;

export function Tareas({
  tareas,
  vendors,
  miembros,
  fechaBoda,
}: {
  tareas: Tarea[];
  vendors: { id: string; nombre: string }[];
  miembros: { nombre: string; rol: string }[];
  fechaBoda: string;
}) {
  const [vista, setVista] = useState<"lista" | "semana" | "calendario">("lista");
  const [responsable, setResponsable] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState("pendientes");
  const [editando, setEditando] = useState<Tarea | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const hoy = hoyISO();
  const en7 = new Date(new Date(hoy).getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const nombreDe = (rol: string) =>
    rol === "ambos"
      ? "Los dos"
      : (miembros.find((m) => m.rol === rol)?.nombre ??
        (rol === "novio" ? "Novio" : "Novia"));

  const filtradas = useMemo(
    () =>
      tareas.filter((t) => {
        if (responsable && t.responsable !== responsable) return false;
        if (categoria && t.categoria !== categoria) return false;
        if (estado === "pendientes" && t.estado === "hecha") return false;
        if (estado === "hechas" && t.estado !== "hecha") return false;
        if (vista === "semana") {
          if (t.estado === "hecha") return false;
          if (!t.fecha_limite || t.fecha_limite > en7) return false;
        }
        return true;
      }),
    [tareas, responsable, categoria, estado, vista, en7],
  );

  const vencidas = tareas.filter(
    (t) => t.estado !== "hecha" && t.fecha_limite && t.fecha_limite < hoy,
  ).length;
  const pendientes = tareas.filter((t) => t.estado !== "hecha").length;

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <Sheet open={nuevaAbierta} onOpenChange={setNuevaAbierta}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Tarea
            </Button>
          </SheetTrigger>
          <SheetContent title="Nueva tarea">
            <FormTarea
              tareas={tareas}
              vendors={vendors}
              nombreDe={nombreDe}
              onListo={() => setNuevaAbierta(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {pendientes} pendientes
        {vencidas > 0 && (
          <span className="text-danger"> · {vencidas} vencidas</span>
        )}
      </p>

      <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            ["lista", "Todas", List],
            ["semana", "Esta semana", ListChecks],
            ["calendario", "Calendario", CalendarDays],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm",
              vista === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {vista === "calendario" ? (
        <CalendarioMensual
          tareas={tareas}
          fechaBoda={fechaBoda}
          onAbrir={setEditando}
        />
      ) : (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Select
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              className="h-9 w-auto text-sm"
            >
              <option value="">Cualquiera</option>
              <option value="novio">{nombreDe("novio")}</option>
              <option value="novia">{nombreDe("novia")}</option>
              <option value="ambos">Los dos</option>
            </Select>
            <Select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-9 w-auto text-sm"
            >
              <option value="">Toda categoría</option>
              {RUBROS.map((r) => (
                <option key={r} value={r}>
                  {RUBRO_LABEL[r]}
                </option>
              ))}
            </Select>
            <Select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="h-9 w-auto text-sm"
            >
              <option value="pendientes">Sin hacer</option>
              <option value="hechas">Hechas</option>
              <option value="todas">Todas</option>
            </Select>
          </div>

          {tareas.length === 0 ? (
            <SembrarChecklist />
          ) : filtradas.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              {vista === "semana"
                ? "No hay nada para esta semana. Aprovechen."
                : "Ninguna tarea coincide con esos filtros."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {filtradas.map((t) => (
                <li key={t.id} className="flex items-center gap-2 pl-2 pr-3">
                  <ToggleHecha tarea={t} />
                  <button
                    onClick={() => setEditando(t)}
                    className="min-w-0 flex-1 py-3 text-left active:bg-muted"
                  >
                    <p
                      className={cn(
                        "truncate",
                        t.estado === "hecha" &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {t.titulo}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[
                        t.fecha_limite ? formatFecha(t.fecha_limite) : null,
                        RUBRO_LABEL[t.categoria],
                        nombreDe(t.responsable),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {t.estado !== "hecha" &&
                        t.fecha_limite &&
                        t.fecha_limite < hoy && (
                          <span className="font-medium text-danger">
                            {" "}
                            · vencida
                          </span>
                        )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tareas.length > 0 && (
            <div className="mt-4">
              <SembrarChecklist compacto />
            </div>
          )}
        </>
      )}

      <Link
        href="/agenda-del-dia"
        className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4"
      >
        <span>
          <span className="font-medium">Agenda del día del evento</span>
          <span className="block text-sm text-muted-foreground">
            Cronograma hora por hora, imprimible
          </span>
        </span>
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
      </Link>

      <Sheet
        open={editando !== null}
        onOpenChange={(a) => !a && setEditando(null)}
      >
        {editando && (
          <SheetContent title={editando.titulo}>
            <FormTarea
              tarea={editando}
              tareas={tareas}
              vendors={vendors}
              nombreDe={nombreDe}
              onListo={() => setEditando(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function ToggleHecha({ tarea }: { tarea: Tarea }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <button
      aria-label={
        tarea.estado === "hecha" ? "Marcar como pendiente" : "Marcar como hecha"
      }
      disabled={pendiente}
      onClick={() =>
        startTransition(async () => {
          await actualizarTarea(tarea.id, {
            estado: tarea.estado === "hecha" ? "pendiente" : "hecha",
          });
        })
      }
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
        tarea.estado === "hecha"
          ? "border-success bg-success/15 text-success"
          : "border-border text-muted-foreground",
        pendiente && "opacity-50",
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function SembrarChecklist({ compacto }: { compacto?: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const boton = (
    <Button
      variant={compacto ? "outline" : "default"}
      size={compacto ? "sm" : "lg"}
      className="w-full"
      disabled={pendiente}
      onClick={() =>
        startTransition(async () => {
          const r = await sembrarChecklist();
          setMensaje(
            r.error
              ? r.error
              : r.creadas === 0
                ? "Ya estaban todas las del checklist."
                : `Agregamos ${r.creadas} tareas.`,
          );
        })
      }
    >
      {pendiente ? "Creando…" : "Traer el checklist estándar"}
    </Button>
  );

  if (compacto) {
    return (
      <>
        {boton}
        {mensaje && (
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {mensaje}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
      <p className="font-medium">Todavía no hay tareas</p>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Podemos armarles el checklist típico de casamiento, con las fechas
        calculadas para atrás desde el día del evento. Después lo editan como
        quieran.
      </p>
      {boton}
      {mensaje && (
        <p className="mt-2 text-sm text-muted-foreground">{mensaje}</p>
      )}
    </div>
  );
}

function FormTarea({
  tarea,
  tareas,
  vendors,
  nombreDe,
  onListo,
}: {
  tarea?: Tarea;
  tareas: Tarea[];
  vendors: { id: string; nombre: string }[];
  nombreDe: (rol: string) => string;
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    const datos: DatosTarea = {
      titulo: String(f.get("titulo") ?? "").trim(),
      descripcion: (String(f.get("descripcion") ?? "").trim() || null) as
        | string
        | null,
      categoria: f.get("categoria") as Rubro,
      responsable: f.get("responsable") as DatosTarea["responsable"],
      fecha_limite: (String(f.get("fecha_limite") ?? "") || null) as
        | string
        | null,
      prioridad: f.get("prioridad") as DatosTarea["prioridad"],
      estado: f.get("estado") as DatosTarea["estado"],
      depende_de: (String(f.get("depende_de") ?? "") || null) as string | null,
      vendor_id: (String(f.get("vendor_id") ?? "") || null) as string | null,
    };

    startTransition(async () => {
      const r = tarea
        ? await actualizarTarea(tarea.id, datos)
        : await crearTarea(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="titulo">Tarea</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          autoFocus={!tarea}
          defaultValue={tarea?.titulo}
          placeholder="Ej: Pedir presupuesto al DJ"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fecha_limite">Fecha límite</Label>
          <Input
            id="fecha_limite"
            name="fecha_limite"
            type="date"
            defaultValue={tarea?.fecha_limite ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="responsable">Responsable</Label>
          <Select
            id="responsable"
            name="responsable"
            defaultValue={tarea?.responsable ?? "ambos"}
            className="mt-1"
          >
            <option value="ambos">Los dos</option>
            <option value="novio">{nombreDe("novio")}</option>
            <option value="novia">{nombreDe("novia")}</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="categoria">Categoría</Label>
          <Select
            id="categoria"
            name="categoria"
            defaultValue={tarea?.categoria ?? "otros"}
            className="mt-1"
          >
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {RUBRO_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="prioridad">Prioridad</Label>
          <Select
            id="prioridad"
            name="prioridad"
            defaultValue={tarea?.prioridad ?? "media"}
            className="mt-1"
          >
            {Object.entries(PRIORIDAD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Select
            id="estado"
            name="estado"
            defaultValue={tarea?.estado ?? "pendiente"}
            className="mt-1"
          >
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="hecha">Hecha</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="vendor_id">Proveedor</Label>
          <Select
            id="vendor_id"
            name="vendor_id"
            defaultValue={tarea?.vendor_id ?? ""}
            className="mt-1"
          >
            <option value="">Ninguno</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="depende_de">Depende de</Label>
        <Select
          id="depende_de"
          name="depende_de"
          defaultValue={tarea?.depende_de ?? ""}
          className="mt-1"
        >
          <option value="">Nada</option>
          {tareas
            .filter((t) => t.id !== tarea?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="descripcion">Notas</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          defaultValue={tarea?.descripcion ?? ""}
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : tarea ? "Guardar" : "Agregar tarea"}
      </Button>

      {tarea && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar "${tarea.titulo}"?`)) return;
            startTransition(async () => {
              const r = await borrarTarea(tarea.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar tarea
        </Button>
      )}
    </form>
  );
}
