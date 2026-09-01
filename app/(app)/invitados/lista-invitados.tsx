"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Plus, Search, Upload, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, Eyebrow } from "@/components/ui/card";
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
  confirmado: "bg-success-soft text-success",
  rechazado: "bg-danger-soft text-danger",
} as const;

const MENU_LABEL = {
  ninguno: "",
  vegetariano: "Vegetariano",
  celiaco: "Celíaco",
  otro: "Menú especial",
} as const;

const MENU_COLOR = {
  ninguno: "",
  vegetariano: "bg-sage-soft text-sage",
  celiaco: "bg-warning-soft text-warning",
  otro: "bg-muted text-muted-foreground",
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

  const personas = invitados.reduce((n, i) => n + 1 + i.acompanantes, 0);
  const confirmados = invitados
    .filter((i) => i.rsvp === "confirmado")
    .reduce((n, i) => n + 1 + i.acompanantes, 0);
  const pendientes = invitados.filter((i) => i.rsvp === "pendiente").length;
  const rechazados = invitados.filter((i) => i.rsvp === "rechazado").length;
  const especiales = invitados.filter((i) => i.menu !== "ninguno");
  const hayFiltros = busqueda || lado || rsvp || grupo || soloMenu;
  const mesaDe = (id: string | null) =>
    mesas.find((m) => m.id === id)?.numero ?? null;

  const limpiar = () => {
    setBusqueda("");
    setLado("");
    setRsvp("");
    setGrupo("");
    setSoloMenu(false);
  };

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-normal lg:text-[28px]">
          Invitados
        </h1>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Importar"
                className="lg:hidden"
              >
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
            className="lg:hidden"
          >
            <a href="/invitados/export">
              <Download className="h-5 w-5" />
            </a>
          </Button>

          {/* En escritorio hay lugar para las acciones con texto */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:inline-flex"
              >
                <Upload className="h-4 w-4" /> Importar
              </Button>
            </SheetTrigger>
            <SheetContent title="Importar invitados">
              <ImportarInvitados />
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden lg:inline-flex"
          >
            <a href="/invitados/export">
              <Download className="h-4 w-4" /> Exportar CSV
            </a>
          </Button>
          <Button
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setNuevoAbierto(true)}
          >
            <Plus className="h-4 w-4" /> Invitado
          </Button>
        </div>
      </div>

      {/* contadores: en escritorio viven en el panel de la derecha */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center lg:hidden">
        <Contador valor={personas} label="Total" />
        <Contador valor={confirmados} label="Confirman" />
        <Contador valor={pendientes} label="Pendientes" />
        <Contador valor={especiales.length} label="Menú esp." />
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_296px] lg:items-start">
        <div className="min-w-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o grupo"
              className="pl-10"
            />
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <Select
              value={lado}
              onChange={(e) => setLado(e.target.value)}
              className="h-9 w-auto rounded-full text-sm"
            >
              <option value="">Ambos lados</option>
              <option value="novio">Lado novio</option>
              <option value="novia">Lado novia</option>
            </Select>
            <Select
              value={rsvp}
              onChange={(e) => setRsvp(e.target.value)}
              className="h-9 w-auto rounded-full text-sm"
            >
              <option value="">Todo RSVP</option>
              <option value="pendiente">Pendientes</option>
              <option value="confirmado">Confirmados</option>
              <option value="rechazado">No vienen</option>
            </Select>
            <Select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="h-9 w-auto rounded-full text-sm"
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
              className="shrink-0 rounded-full"
              onClick={() => setSoloMenu(!soloMenu)}
            >
              Menú especial
            </Button>
            {hayFiltros && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={limpiar}
              >
                <X className="h-4 w-4" /> Limpiar
              </Button>
            )}
          </div>

          {invitados.length === 0 ? (
            <Card className="mt-6 border-dashed p-6 text-center">
              <p className="font-medium">Todavía no cargaron invitados</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Agregá uno con el botón +, o pegá la lista que ya tengan en una
                planilla con el botón de importar.
              </p>
            </Card>
          ) : filtrados.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              Ningún invitado coincide con esos filtros.
            </p>
          ) : (
            <>
              {/* ---- celular: lista ---- */}
              <ul className="mt-3 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:hidden">
                {filtrados.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 pr-3">
                    <button
                      onClick={() => setEditando(i)}
                      className="min-w-0 flex-1 px-4 py-3 text-left active:bg-muted"
                    >
                      <p className="truncate font-medium">
                        {i.nombre}
                        {i.acompanantes > 0 && (
                          <span className="text-subtle">
                            {" "}
                            +{i.acompanantes}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-subtle">
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

              {/* ---- escritorio: tabla ---- */}
              <div className="mt-3 hidden overflow-hidden rounded-2xl border border-border bg-card px-5 pb-2 pt-4 shadow-card lg:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
                      <th className="pb-2.5 pr-4 font-semibold">Nombre</th>
                      <th className="pb-2.5 pr-4 font-semibold">Grupo</th>
                      <th className="pb-2.5 pr-4 font-semibold">Lado</th>
                      <th className="pb-2.5 pr-4 font-semibold">RSVP</th>
                      <th className="pb-2.5 pr-4 text-right font-semibold">
                        Acomp.
                      </th>
                      <th className="pb-2.5 pr-4 font-semibold">Menú</th>
                      <th className="pb-2.5 font-semibold">Mesa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((i) => (
                      <tr
                        key={i.id}
                        className="cursor-pointer border-t border-border-soft text-sm hover:bg-muted/60"
                        onClick={() => setEditando(i)}
                      >
                        <td className="py-2.5 pr-4 font-medium">{i.nombre}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {i.grupo ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {i.lado === "novio" ? "Novio" : "Novia"}
                        </td>
                        <td
                          className="py-2.5 pr-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RsvpRapido invitado={i} />
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                          {i.acompanantes}
                        </td>
                        <td className="py-2.5 pr-4">
                          {i.menu === "ninguno" ? (
                            <span className="text-subtle">—</span>
                          ) : (
                            <Badge className={MENU_COLOR[i.menu]}>
                              {MENU_LABEL[i.menu]}
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2.5">
                          {mesaDe(i.table_id) ? (
                            <span className="tabular-nums text-muted-foreground">
                              Mesa {mesaDe(i.table_id)}
                            </span>
                          ) : (
                            <span className="font-semibold text-warning">
                              Sin mesa
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ---- panel de resumen, sólo escritorio ---- */}
        {invitados.length > 0 && (
          <div className="hidden flex-col gap-4 lg:flex">
            <Card>
              <Eyebrow>Resumen</Eyebrow>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-4xl leading-none tabular-nums">
                  {personas}
                </span>
                <span className="text-sm text-muted-foreground">
                  personas con acompañantes
                </span>
              </p>
              <div className="my-3.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
                <Franja
                  valor={confirmados}
                  total={personas}
                  clase="bg-success"
                />
                <Franja valor={pendientes} total={personas} clase="bg-muted" />
                <Franja
                  valor={rechazados}
                  total={personas}
                  clase="bg-danger-soft"
                />
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                <Fila
                  clase="bg-success"
                  label="Confirmados"
                  valor={confirmados}
                />
                <Fila clase="bg-muted" label="Pendientes" valor={pendientes} />
                <Fila
                  clase="bg-danger-soft"
                  label="No vienen"
                  valor={rechazados}
                />
              </dl>
            </Card>

            {especiales.length > 0 && (
              <Card>
                <Eyebrow>Menús especiales</Eyebrow>
                <dl className="mt-3 flex flex-col gap-2.5 text-sm">
                  {(["vegetariano", "celiaco", "otro"] as const).map((m) => {
                    const n = especiales.filter((i) => i.menu === m).length;
                    if (n === 0) return null;
                    return (
                      <div key={m} className="flex items-center gap-2">
                        <dt>
                          <Badge className={MENU_COLOR[m]}>
                            {MENU_LABEL[m]}
                          </Badge>
                        </dt>
                        <dd className="ml-auto font-semibold tabular-nums">
                          {n}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-3 border-t border-border-soft pt-3 text-xs text-subtle">
                  Se exportan con el CSV para pasarle al catering.
                </p>
              </Card>
            )}

            {grupos.length > 0 && (
              <Card>
                <Eyebrow>Por grupo</Eyebrow>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {grupos
                    .map((g) => ({
                      g,
                      n: invitados.filter((i) => i.grupo === g).length,
                    }))
                    .sort((a, b) => b.n - a.n)
                    .slice(0, 6)
                    .map(({ g, n }, _, arr) => (
                      <li key={g}>
                        <p className="mb-1 flex text-xs">
                          <span>{g}</span>
                          <span className="ml-auto tabular-nums text-subtle">
                            {n}
                          </span>
                        </p>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-sage"
                            style={{ width: `${(n / arr[0].n) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>

      <Sheet open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg lg:hidden"
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
    <div className="rounded-xl bg-muted px-1 py-2.5">
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-[11px] text-subtle">{label}</p>
    </div>
  );
}

function Franja({
  valor,
  total,
  clase,
}: {
  valor: number;
  total: number;
  clase: string;
}) {
  if (valor <= 0) return null;
  return (
    <div
      className={`${clase} first:rounded-l-full last:rounded-r-full`}
      style={{ width: `${total > 0 ? (valor / total) * 100 : 0}%` }}
    />
  );
}

function Fila({
  clase,
  label,
  valor,
}: {
  clase: string;
  label: string;
  valor: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <i className={`h-2 w-2 shrink-0 rounded-[2px] ${clase}`} />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * Tocar el estado lo rota pendiente → confirmado → no viene, sin abrir la ficha.
 * Se pinta al instante y recién después viaja al servidor.
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
      <Badge className={cn("shrink-0", RSVP_COLOR[rsvp])}>
        {RSVP_LABEL[rsvp]}
      </Badge>
    </button>
  );
}
