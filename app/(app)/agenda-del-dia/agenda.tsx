"use client";

import { useState, useTransition } from "react";
import { Plus, Printer, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatFecha } from "@/lib/format";
import {
  crearEventoAgenda,
  actualizarEventoAgenda,
  borrarEventoAgenda,
} from "../tareas/actions";

type Evento = {
  id: string;
  hora: string;
  actividad: string;
  responsable: string | null;
  notas: string | null;
};

export function Agenda({
  eventos,
  fecha,
  lugar,
}: {
  eventos: Evento[];
  fecha: string;
  lugar: string;
}) {
  const [editando, setEditando] = useState<Evento | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  return (
    <main>
      <div className="no-print flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agenda del día</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Imprimir o guardar en PDF"
            onClick={() => window.print()}
          >
            <Printer className="h-5 w-5" />
          </Button>
          <Sheet open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
            <SheetTrigger asChild>
              <Button size="icon" aria-label="Agregar actividad">
                <Plus className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Nueva actividad">
              <FormEvento onListo={() => setNuevoAbierto(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <header className="mt-1">
        <p className="text-muted-foreground">
          {formatFecha(fecha)} · {lugar}
        </p>
      </header>

      {eventos.length === 0 ? (
        <div className="no-print mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Todavía no armaron el cronograma</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá las horas clave del día: llegada del fotógrafo, ceremonia,
            cóctel, entrada al salón, vals, torta, carnaval carioca. Después lo
            imprimís o lo guardás en PDF para pasárselo a los proveedores.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-0">
          {eventos.map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-border py-3">
              <span className="w-14 shrink-0 tabular-nums font-medium">
                {e.hora.slice(0, 5)}
              </span>
              <div className="min-w-0 flex-1">
                <p>{e.actividad}</p>
                {(e.responsable || e.notas) && (
                  <p className="text-sm text-muted-foreground">
                    {[e.responsable, e.notas].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditando(e)}
                aria-label={`Editar ${e.actividad}`}
                className="no-print shrink-0 rounded-lg p-2 hover:bg-muted"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <Sheet
        open={editando !== null}
        onOpenChange={(a) => !a && setEditando(null)}
      >
        {editando && (
          <SheetContent title={editando.actividad}>
            <FormEvento evento={editando} onListo={() => setEditando(null)} />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function FormEvento({
  evento,
  onListo,
}: {
  evento?: Evento;
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const datos = {
      hora: String(f.get("hora")),
      actividad: String(f.get("actividad") ?? "").trim(),
      responsable: (String(f.get("responsable") ?? "").trim() || null) as
        | string
        | null,
      notas: (String(f.get("notas") ?? "").trim() || null) as string | null,
    };

    startTransition(async () => {
      const r = evento
        ? await actualizarEventoAgenda(evento.id, datos)
        : await crearEventoAgenda(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="hora">Hora</Label>
          <Input
            id="hora"
            name="hora"
            type="time"
            required
            defaultValue={evento?.hora.slice(0, 5) ?? "20:00"}
            className="mt-1"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="actividad">Actividad</Label>
          <Input
            id="actividad"
            name="actividad"
            required
            autoFocus={!evento}
            defaultValue={evento?.actividad}
            placeholder="Ej: Entrada al salón"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="responsable">Responsable</Label>
        <Input
          id="responsable"
          name="responsable"
          defaultValue={evento?.responsable ?? ""}
          placeholder="Ej: DJ, fotógrafo, ceremoniera"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          name="notas"
          defaultValue={evento?.notas ?? ""}
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : evento ? "Guardar" : "Agregar"}
      </Button>

      {evento && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar "${evento.actividad}"?`)) return;
            startTransition(async () => {
              const r = await borrarEventoAgenda(evento.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar actividad
        </Button>
      )}
    </form>
  );
}
