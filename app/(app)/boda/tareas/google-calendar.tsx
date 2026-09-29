"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Link privado para suscribirse a las tareas desde Google Calendar. */
export function GoogleCalendar({ token }: { token: string }) {
  const [host, setHost] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => setHost(window.location.host), []);
  if (!host) return null;

  const path = `/api/calendario/${token}.ics`;
  const url = `https://${host}${path}`;
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${host}${path}`)}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }

  return (
    <details className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
        <CalendarDays className="h-4 w-4" /> Ver en Google Calendar
      </summary>
      <p className="mt-2 text-muted-foreground">
        Las tareas con fecha aparecen como eventos de día completo. Es de solo lectura: se editan acá y Google
        las actualiza cada algunas horas. Cada uno lo agrega en su propia cuenta.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={google} target="_blank" rel="noreferrer">
            Agregar a Google Calendar
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={copiar}>
          {copiado ? "¡Copiado!" : "Copiar link"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Si el botón no funciona: en Google Calendar → Otros calendarios → + → Desde URL, y pegá el link. No lo
        compartas: quien lo tenga ve las tareas.
      </p>
    </details>
  );
}
