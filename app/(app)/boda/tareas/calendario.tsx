"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFecha, hoyISO } from "@/lib/format";
import type { Tarea } from "./tareas";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function CalendarioMensual({
  tareas,
  fechaBoda,
  onAbrir,
}: {
  tareas: Tarea[];
  fechaBoda: string;
  onAbrir: (t: Tarea) => void;
}) {
  const hoy = hoyISO();
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const [diaElegido, setDiaElegido] = useState<string | null>(null);

  const [anio, m] = mes.split("-").map(Number);
  const primero = new Date(anio, m - 1, 1);
  const diasEnMes = new Date(anio, m, 0).getDate();
  // getDay() da 0 para domingo; la semana arranca en lunes.
  const offset = (primero.getDay() + 6) % 7;

  const iso = (dia: number) =>
    `${anio}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  const delDia = (fecha: string) =>
    tareas.filter((t) => t.fecha_limite === fecha);

  function cambiarMes(delta: number) {
    const d = new Date(anio, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaElegido(null);
  }

  const tareasDelDia = diaElegido ? delDia(diaElegido) : [];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => cambiarMes(-1)}
          aria-label="Mes anterior"
          className="rounded-lg p-2 hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-serif text-lg font-normal">
          {MESES[m - 1]} de {anio}
        </p>
        <button
          onClick={() => cambiarMes(1)}
          aria-label="Mes siguiente"
          className="rounded-lg p-2 hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {DIAS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => (
          <div key={`v${i}`} />
        ))}

        {Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1;
          const fecha = iso(dia);
          const delDiaTareas = delDia(fecha);
          const sinHacer = delDiaTareas.filter((t) => t.estado !== "hecha");
          const esBoda = fecha === fechaBoda.slice(0, 10);

          return (
            <button
              key={dia}
              onClick={() => setDiaElegido(fecha)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm",
                fecha === hoy
                  ? "border-primary font-semibold"
                  : "border-transparent",
                diaElegido === fecha && "bg-muted",
                esBoda && "bg-primary/10",
              )}
            >
              <span className="flex items-center gap-0.5">
                {dia}
                {esBoda && (
                  <Heart className="h-3 w-3 fill-primary text-primary" />
                )}
              </span>
              {delDiaTareas.length > 0 && (
                <span
                  className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    sinHacer.length > 0
                      ? fecha < hoy
                        ? "bg-danger"
                        : "bg-primary"
                      : "bg-success",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {diaElegido && (
        <section className="mt-4">
          <h2 className="font-serif text-lg font-normal">
            {formatFecha(diaElegido)}
          </h2>
          {tareasDelDia.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No hay tareas con vencimiento ese día.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {tareasDelDia.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onAbrir(t)}
                    className="w-full px-3 py-3 text-left active:bg-muted"
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
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
