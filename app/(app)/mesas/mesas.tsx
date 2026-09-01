"use client";

import { useState, useTransition } from "react";
import { Plus, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { crearMesa, actualizarMesa, borrarMesa, asignarAMesa } from "./actions";

type Mesa = {
  id: string;
  numero: number;
  capacidad: number;
  ubicacion: string | null;
};

type Invitado = {
  id: string;
  nombre: string;
  grupo: string | null;
  acompanantes: number;
  rsvp: "pendiente" | "confirmado" | "rechazado";
  table_id: string | null;
};

export function Mesas({
  mesas,
  invitados,
}: {
  mesas: Mesa[];
  invitados: Invitado[];
}) {
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [editando, setEditando] = useState<Mesa | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const sinMesa = invitados.filter((i) => !i.table_id);
  const lugares = (lista: Invitado[]) =>
    lista.reduce((n, i) => n + 1 + i.acompanantes, 0);

  const sobrecargadas = mesas.filter(
    (m) => lugares(invitados.filter((i) => i.table_id === m.id)) > m.capacidad,
  );

  function asignar(tableId: string | null) {
    if (seleccion.length === 0) return;
    startTransition(async () => {
      await asignarAMesa(seleccion, tableId);
      setSeleccion([]);
    });
  }

  function alternar(id: string) {
    setSeleccion((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  return (
    <main className="pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal lg:text-[28px]">
          Mesas
        </h1>
        <Sheet open={nuevaAbierta} onOpenChange={setNuevaAbierta}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Mesa
            </Button>
          </SheetTrigger>
          <SheetContent title="Nueva mesa">
            <FormMesa
              sugerido={Math.max(0, ...mesas.map((m) => m.numero)) + 1}
              onListo={() => setNuevaAbierta(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {sinMesa.length > 0
          ? `${sinMesa.length} invitados sin mesa`
          : invitados.length > 0
            ? "Todos los invitados tienen mesa"
            : "Todavía no hay invitados cargados"}
        {sobrecargadas.length > 0 &&
          ` · ${sobrecargadas.length} mesas pasadas de capacidad`}
      </p>

      {mesas.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-serif text-lg font-normal">Todavía no hay mesas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá la primera con el botón “Mesa”. Después tocá invitados de la
            lista de abajo y asignalos.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {mesas.map((m) => {
            const enMesa = invitados.filter((i) => i.table_id === m.id);
            const ocupados = lugares(enMesa);
            const excedida = ocupados > m.capacidad;

            return (
              <section
                key={m.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id)
                    startTransition(async () => {
                      await asignarAMesa([id], m.id);
                    });
                }}
                className={cn(
                  "rounded-2xl border bg-card p-3.5 shadow-card",
                  excedida ? "border-danger" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-serif text-lg font-normal">
                      Mesa {m.numero}
                      {m.ubicacion && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {m.ubicacion}
                        </span>
                      )}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        excedida ? "text-danger" : "text-muted-foreground",
                      )}
                    >
                      {excedida && (
                        <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      )}
                      {ocupados} de {m.capacidad} lugares
                    </p>
                  </div>
                  <button
                    onClick={() => setEditando(m)}
                    aria-label={`Editar mesa ${m.numero}`}
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {enMesa.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {enMesa.map((i) => (
                      <li key={i.id}>
                        <button
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", i.id)
                          }
                          onClick={() => alternar(i.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-sm",
                            seleccion.includes(i.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted",
                          )}
                        >
                          {i.nombre}
                          {i.acompanantes > 0 && ` +${i.acompanantes}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {seleccion.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={pendiente}
                    onClick={() => asignar(m.id)}
                  >
                    Mover {seleccion.length} acá
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {sinMesa.length > 0 && (
        <section
          className="mt-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            if (id)
              startTransition(async () => {
                await asignarAMesa([id], null);
              });
          }}
        >
          <h2 className="font-serif text-lg font-normal">
            Sin mesa ({sinMesa.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Tocá los que quieras y elegí una mesa arriba.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {sinMesa.map((i) => (
              <li key={i.id}>
                <button
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", i.id)
                  }
                  onClick={() => alternar(i.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-sm",
                    seleccion.includes(i.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  {i.nombre}
                  {i.acompanantes > 0 && ` +${i.acompanantes}`}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {seleccion.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card p-3">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <span className="text-sm">{seleccion.length} seleccionados</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setSeleccion([])}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() => asignar(null)}
            >
              Sacar de la mesa
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={editando !== null}
        onOpenChange={(abierto) => !abierto && setEditando(null)}
      >
        {editando && (
          <SheetContent title={`Mesa ${editando.numero}`}>
            <FormMesa mesa={editando} onListo={() => setEditando(null)} />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function FormMesa({
  mesa,
  sugerido,
  onListo,
}: {
  mesa?: Mesa;
  sugerido?: number;
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const datos = {
      numero: Number(f.get("numero")),
      capacidad: Number(f.get("capacidad")),
      ubicacion: (String(f.get("ubicacion") ?? "").trim() || null) as
        | string
        | null,
    };

    startTransition(async () => {
      const r = mesa
        ? await actualizarMesa(mesa.id, datos)
        : await crearMesa(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            name="numero"
            type="number"
            min={1}
            inputMode="numeric"
            required
            defaultValue={mesa?.numero ?? sugerido ?? 1}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="capacidad">Capacidad</Label>
          <Input
            id="capacidad"
            name="capacidad"
            type="number"
            min={1}
            inputMode="numeric"
            required
            defaultValue={mesa?.capacidad ?? 10}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ubicacion">Ubicación</Label>
        <Input
          id="ubicacion"
          name="ubicacion"
          defaultValue={mesa?.ubicacion ?? ""}
          placeholder="Ej: cerca de la pista"
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : mesa ? "Guardar" : "Crear mesa"}
      </Button>

      {mesa && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar la mesa ${mesa.numero}?`)) return;
            startTransition(async () => {
              const r = await borrarMesa(mesa.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar mesa
        </Button>
      )}
    </form>
  );
}
