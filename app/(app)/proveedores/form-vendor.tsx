"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RUBROS, RUBRO_LABEL, type Rubro } from "@/lib/format";
import {
  crearVendor,
  actualizarVendor,
  borrarVendor,
  type DatosVendor,
} from "./actions";

export type Vendor = DatosVendor & { id: string };

export function FormVendor({
  vendor,
  onListo,
}: {
  vendor?: Vendor;
  onListo: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rating = String(f.get("rating") ?? "");

    const datos: DatosVendor = {
      nombre: String(f.get("nombre") ?? "").trim(),
      rubro: f.get("rubro") as Rubro,
      contacto: (String(f.get("contacto") ?? "").trim() || null) as
        | string
        | null,
      telefono: (String(f.get("telefono") ?? "").trim() || null) as
        | string
        | null,
      web_ig: (String(f.get("web_ig") ?? "").trim() || null) as string | null,
      estado: f.get("estado") as DatosVendor["estado"],
      rating: rating === "" ? null : Number(rating),
      notas: (String(f.get("notas") ?? "").trim() || null) as string | null,
    };

    startTransition(async () => {
      const r = vendor
        ? await actualizarVendor(vendor.id, datos)
        : await crearVendor(datos);
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
          autoFocus={!vendor}
          defaultValue={vendor?.nombre}
          placeholder="Ej: Estancia La Elvira"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rubro">Rubro</Label>
          <Select
            id="rubro"
            name="rubro"
            defaultValue={vendor?.rubro ?? "otros"}
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
          <Label htmlFor="estado">Estado</Label>
          <Select
            id="estado"
            name="estado"
            defaultValue={vendor?.estado ?? "contactado"}
            className="mt-1"
          >
            <option value="contactado">Contactado</option>
            <option value="presupuesto_recibido">Presupuesto recibido</option>
            <option value="contratado">Contratado</option>
            <option value="descartado">Descartado</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contacto">Contacto</Label>
          <Input
            id="contacto"
            name="contacto"
            defaultValue={vendor?.contacto ?? ""}
            placeholder="Nombre o mail"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            defaultValue={vendor?.telefono ?? ""}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="web_ig">Web o Instagram</Label>
          <Input
            id="web_ig"
            name="web_ig"
            defaultValue={vendor?.web_ig ?? ""}
            placeholder="@cuenta o sitio"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="rating">Nuestro puntaje</Label>
          <Select
            id="rating"
            name="rating"
            defaultValue={vendor?.rating?.toString() ?? ""}
            className="mt-1"
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notas">Notas e historial de contacto</Label>
        <Textarea
          id="notas"
          name="notas"
          rows={4}
          defaultValue={vendor?.notas ?? ""}
          placeholder="Ej: 12/03 llamamos, tiene la fecha libre. 20/03 mandó presupuesto."
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : vendor ? "Guardar" : "Agregar proveedor"}
      </Button>

      {vendor && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar ${vendor.nombre} y sus presupuestos?`)) return;
            startTransition(async () => {
              const r = await borrarVendor(vendor.id);
              if (r.error) setError(r.error);
              else router.push("/proveedores");
            });
          }}
        >
          Borrar proveedor
        </Button>
      )}
    </form>
  );
}
