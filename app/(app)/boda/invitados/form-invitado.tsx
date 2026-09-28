"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crearInvitado, actualizarInvitado, borrarInvitado } from "./actions";
import type { Invitado } from "./lista-invitados";

export function FormInvitado({
  invitado,
  grupos,
  mesas,
  onListo,
}: {
  invitado?: Invitado;
  grupos: string[];
  mesas: { id: string; numero: number }[];
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Los campos secundarios arrancan ocultos: alta rápida en 3 taps.
  const [verMas, setVerMas] = useState(false);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const datos = {
      nombre: String(f.get("nombre") ?? "").trim(),
      grupo: (String(f.get("grupo") ?? "").trim() || null) as string | null,
      lado: f.get("lado") as "novio" | "novia",
      email: (String(f.get("email") ?? "").trim() || null) as string | null,
      telefono: (String(f.get("telefono") ?? "").trim() || null) as
        | string
        | null,
      rsvp: f.get("rsvp") as Invitado["rsvp"],
      acompanantes: Number(f.get("acompanantes") ?? 0),
      menu: f.get("menu") as Invitado["menu"],
      menu_detalle: (String(f.get("menu_detalle") ?? "").trim() || null) as
        | string
        | null,
      alojamiento: f.get("alojamiento") === "on",
      notas: (String(f.get("notas") ?? "").trim() || null) as string | null,
    };

    startTransition(async () => {
      const r = invitado
        ? await actualizarInvitado(invitado.id, {
            ...datos,
            table_id: (String(f.get("table_id") ?? "") || null) as
              | string
              | null,
          })
        : await crearInvitado(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          autoFocus={!invitado}
          defaultValue={invitado?.nombre}
          placeholder="Nombre y apellido"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="lado">Lado</Label>
          <Select
            id="lado"
            name="lado"
            defaultValue={invitado?.lado ?? "novio"}
            className="mt-1"
          >
            <option value="novio">Novio</option>
            <option value="novia">Novia</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="grupo">Grupo / familia</Label>
          <Input
            id="grupo"
            name="grupo"
            list="grupos"
            defaultValue={invitado?.grupo ?? ""}
            placeholder="Ej: Tíos"
            className="mt-1"
          />
          <datalist id="grupos">
            {grupos.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rsvp">RSVP</Label>
          <Select
            id="rsvp"
            name="rsvp"
            defaultValue={invitado?.rsvp ?? "pendiente"}
            className="mt-1"
          >
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="rechazado">No viene</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="acompanantes">Acompañantes</Label>
          <Input
            id="acompanantes"
            name="acompanantes"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={invitado?.acompanantes ?? 0}
            className="mt-1"
          />
        </div>
      </div>

      {!verMas && (
        <button
          type="button"
          onClick={() => setVerMas(true)}
          className="text-sm text-primary underline"
        >
          Más datos (menú, contacto, mesa, notas)
        </button>
      )}

      {/*
        Se ocultan con CSS en vez de desmontarlos: si no están en el DOM, el
        form los manda vacíos y guardar borraría menú, contacto, mesa y notas.
      */}
      <div className={verMas ? "space-y-3" : "hidden"}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="menu">Menú</Label>
            <Select
              id="menu"
              name="menu"
              defaultValue={invitado?.menu ?? "ninguno"}
              className="mt-1"
            >
              <option value="ninguno">Sin restricción</option>
              <option value="vegetariano">Vegetariano</option>
              <option value="celiaco">Celíaco</option>
              <option value="otro">Otro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="menu_detalle">Detalle del menú</Label>
            <Input
              id="menu_detalle"
              name="menu_detalle"
              defaultValue={invitado?.menu_detalle ?? ""}
              placeholder="Ej: sin lactosa"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              defaultValue={invitado?.telefono ?? ""}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={invitado?.email ?? ""}
              className="mt-1"
            />
          </div>
        </div>

        {invitado && (
          <div>
            <Label htmlFor="table_id">Mesa</Label>
            <Select
              id="table_id"
              name="table_id"
              defaultValue={invitado.table_id ?? ""}
              className="mt-1"
            >
              <option value="">Sin mesa</option>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  Mesa {m.numero}
                </option>
              ))}
            </Select>
          </div>
        )}

        <label className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            name="alojamiento"
            defaultChecked={invitado?.alojamiento}
            className="h-5 w-5 rounded border-input"
          />
          <span className="text-sm">Necesita alojamiento</span>
        </label>

        <div>
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            name="notas"
            defaultValue={invitado?.notas ?? ""}
            className="mt-1"
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : invitado ? "Guardar" : "Agregar invitado"}
      </Button>

      {invitado && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar a ${invitado.nombre}?`)) return;
            startTransition(async () => {
              const r = await borrarInvitado(invitado.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar invitado
        </Button>
      )}
    </form>
  );
}
