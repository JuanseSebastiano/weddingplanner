"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parsearInvitados } from "@/lib/importar-invitados";
import { importarInvitados } from "./actions";

export function ImportarInvitados() {
  const [texto, setTexto] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<number | null>(null);

  const { filas, errores } = parsearInvitados(texto);

  return (
    <div className="space-y-3">
      {listo !== null ? (
        <div className="rounded-lg bg-success/10 p-4 text-center">
          <p className="font-medium">Importamos {listo} invitados</p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => {
              setTexto("");
              setListo(null);
            }}
          >
            Importar otra lista
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Pegá la lista desde una planilla o un CSV. Si la primera fila tiene
            encabezados (nombre, grupo, lado, email, telefono, rsvp,
            acompanantes, menu, notas) los usamos; si no, tomamos la primera
            columna como nombre.
          </p>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            placeholder={"nombre\tgrupo\tlado\nAna Pérez\tTíos\tnovia"}
            className="font-mono text-sm"
          />

          {texto.trim() && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">
                {filas.length} invitados listos para importar
              </p>
              {filas.slice(0, 4).map((f, i) => (
                <p key={i} className="truncate text-muted-foreground">
                  {f.nombre}
                  {f.grupo ? ` · ${f.grupo}` : ""} ·{" "}
                  {f.lado === "novio" ? "lado novio" : "lado novia"}
                </p>
              ))}
              {filas.length > 4 && (
                <p className="text-muted-foreground">
                  y {filas.length - 4} más…
                </p>
              )}
              {errores.length > 0 && (
                <p className="mt-2 text-warning">
                  {errores.length} líneas se saltean: {errores[0]}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            size="lg"
            className="w-full"
            disabled={filas.length === 0 || pendiente}
            onClick={() =>
              startTransition(async () => {
                const r = await importarInvitados(filas);
                if (r.error) setError(r.error);
                else setListo(r.importados ?? filas.length);
              })
            }
          >
            {pendiente ? "Importando…" : `Importar ${filas.length} invitados`}
          </Button>
        </>
      )}
    </div>
  );
}
