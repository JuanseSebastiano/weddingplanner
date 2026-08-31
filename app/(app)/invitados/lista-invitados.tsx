"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Plus, Search, Upload, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FormInvitado } from "./form-invitado";
import { ImportarInvitados } from "./importar";
import { actualizarInvitado } from "./actions";

export type Invitado = {
  id: string;
  nombre: string;
  grupo: string | null;
  lado: "novio" | "novia";
  email: string | null;
  telefono: string | null;
  rsvp: "pendiente" | "confirmado" | "rechazado";
  acompanantes: number;
  menu: "ninguno" | "vegetariano" | "celiaco" | "otro";
  menu_detalle: string | null;
  alojamiento: boolean;
  notas: string | null;
  table_id: string | null;
};

const RSVP_LABEL = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "No viene",
} as const;

const RSVP_COLOR = {
  pendiente: "bg-muted text-muted-foreground",
  confirmado: "bg-success/15 text-success",
  rechazado: "bg-danger/10 text-danger",
} as const;

const MENU_LABEL = {
  ninguno: "",
  vegetariano: "Vegetariano",
  celiaco: "Celíaco",
  otro: "Menú especial",
} as const;

export function ListaInvitados({
  invitados,
  mesas,
}: {
  invitados: Invitado[];
  mesas: { id: string; numero: number }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [lado, setLado] = useState("");
  const [rsvp, setRsvp] = useState("");
  const [grupo, setGrupo] = useState("");
  const [soloMenu, setSoloMenu] = useState(false);
  const [editando, setEditando] = useState<Invitado | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const grupos = useMemo(
    () =>
      [
        ...new Set(invitados.map((i) => i.grupo).filter(Boolean)),
      ].sort() as string[],
    [invitados],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return invitados.filter((i) => {
      if (q && !`${i.nombre} ${i.grupo ?? ""}`.toLowerCase().includes(q))
        return false;
      if (lado && i.lado !== lado) return false;
      if (rsvp && i.rsvp !== rsvp) return false;
      if (grupo && i.grupo !== grupo) return false;
      if (soloMenu && i.menu === "ninguno") return false;
      return true;
    });
  }, [invitados, busqueda, lado, rsvp, grupo, soloMenu]);

  const total = invitados.reduce((n, i) => n + 1 + i.acompanantes, 0);
  const confirmados = invitados
    .filter((i) => i.rsvp === "confirmado")
    .reduce((n, i) => n + 1 + i.acompanantes, 0);
  const pendientes = invitados.filter((i) => i.rsvp === "pendiente").length;
  const especiales = invitados.filter((i) => i.menu !== "ninguno").length;
  const hayFiltros = busqueda || lado || rsvp || grupo || soloMenu;

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invitados</h1>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Importar">
                <Upload className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Importar invitados">
              <ImportarInvitados />
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="icon"
            asChild
            aria-label="Exportar CSV"
          >
            <a href="/invitados/export">
              <Download className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Contador valor={total} label="Total" />
        <Contador valor={confirmados} label="Confirman" />
        <Contador valor={pendientes} label="Pendientes" />
        <Contador valor={especiales} label="Menú esp." />
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o grupo"
          className="pl-9"
        />
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Select
          value={lado}
          onChange={(e) => setLado(e.target.value)}
          className="h-9 w-auto text-sm"
        >
          <option value="">Ambos lados</option>
          <option value="novio">Lado novio</option>
          <option value="novia">Lado novia</option>
        </Select>
        <Select
          value={rsvp}
          onChange={(e) => setRsvp(e.target.value)}
          className="h-9 w-auto text-sm"
        >
          <option value="">Todo RSVP</option>
          <option value="pendiente">Pendientes</option>
          <option value="confirmado">Confirmados</option>
          <option value="rechazado">No vienen</option>
        </Select>
        <Select
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          className="h-9 w-auto text-sm"
        >
          <option value="">Todos los grupos</option>
          {grupos.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Button
          variant={soloMenu ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setSoloMenu(!soloMenu)}
        >
          Menú especial
        </Button>
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setBusqueda("");
              setLado("");
              setRsvp("");
              setGrupo("");
              setSoloMenu(false);
            }}
          >
            <X className="h-4 w-4" /> Limpiar
          </Button>
        )}
      </div>

      {invitados.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Todavía no cargaron invitados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregá uno con el botón +, o pegá la lista que ya tengan en una
            planilla con el botón de importar.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">
          Ningún invitado coincide con esos filtros.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filtrados.map((i) => (
            <li key={i.id} className="flex items-center gap-2 pr-3">
              <button
                onClick={() => setEditando(i)}
                className="min-w-0 flex-1 px-4 py-3 text-left active:bg-muted"
              >
                <p className="truncate font-medium">
                  {i.nombre}
                  {i.acompanantes > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      +{i.acompanantes}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {[
                    i.grupo,
                    i.lado === "novio" ? "Lado novio" : "Lado novia",
                    MENU_LABEL[i.menu],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <RsvpRapido invitado={i} />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg"
            aria-label="Agregar invitado"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent title="Nuevo invitado">
          <FormInvitado
            grupos={grupos}
            mesas={mesas}
            onListo={() => setNuevoAbierto(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={editando !== null}
        onOpenChange={(abierto) => !abierto && setEditando(null)}
      >
        {editando && (
          <SheetContent title={editando.nombre}>
            <FormInvitado
              invitado={editando}
              grupos={grupos}
              mesas={mesas}
              onListo={() => setEditando(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function Contador({ valor, label }: { valor: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-1 py-2">
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Tocar el estado lo rota pendiente → confirmado → no viene, sin abrir la ficha.
 * Se pinta al instante y recién después viaja al servidor: si algo falla,
 * useOptimistic vuelve solo al valor real.
 */
function RsvpRapido({ invitado }: { invitado: Invitado }) {
  const [rsvp, setRsvp] = useOptimistic(invitado.rsvp);
  const [, startTransition] = useTransition();
  const siguiente = {
    pendiente: "confirmado",
    confirmado: "rechazado",
    rechazado: "pendiente",
  } as const;

  return (
    <button
      aria-label={`Cambiar RSVP de ${invitado.nombre}`}
      onClick={() =>
        startTransition(async () => {
          setRsvp(siguiente[rsvp]);
          await actualizarInvitado(invitado.id, { rsvp: siguiente[rsvp] });
        })
      }
    >
      <Badge className={cn("shrink-0 px-2.5 py-1", RSVP_COLOR[rsvp])}>
        {RSVP_LABEL[rsvp]}
      </Badge>
    </button>
  );
}
