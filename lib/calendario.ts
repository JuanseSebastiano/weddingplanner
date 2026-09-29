/*
 * Tareas de la boda como calendario iCalendar (RFC 5545), para suscribirse
 * desde Google Calendar con un link. Un evento de día completo por tarea
 * con fecha límite.
 */

export type TareaCalendario = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  estado: string;
  responsable: string;
};

function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Corta las líneas a 75 bytes como pide la RFC, sin partir caracteres. */
function plegar(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const c of linea) {
    const n = Buffer.byteLength(c);
    const limite = partes.length === 0 ? 75 : 74;
    if (bytes + n > limite) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += c;
    bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

const fechaIcs = (iso: string) => iso.replace(/-/g, "");

function diaSiguiente(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function tareasIcs(
  tareas: TareaCalendario[],
  nombreDe: (responsable: string) => string,
  ahora = new Date(),
): string {
  const stamp = ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nosotros//Tareas de la boda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Boda · tareas",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
  ];
  for (const t of tareas) {
    if (!t.fecha_limite) continue;
    const hecha = t.estado === "hecha";
    const descripcion = [t.descripcion, `Responsable: ${nombreDe(t.responsable)}`]
      .filter(Boolean)
      .join("\n");
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@nosotros`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${fechaIcs(t.fecha_limite)}`,
      `DTEND;VALUE=DATE:${fechaIcs(diaSiguiente(t.fecha_limite))}`,
      `SUMMARY:${escapar((hecha ? "✓ " : "") + t.titulo)}`,
      `DESCRIPTION:${escapar(descripcion)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
