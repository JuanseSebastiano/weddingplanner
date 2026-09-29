import { describe, expect, it } from "vitest";
import { tareasIcs, type TareaCalendario } from "./calendario";

const base: TareaCalendario = {
  id: "t1",
  titulo: "Reservar salón",
  descripcion: null,
  fecha_limite: "2026-12-31",
  estado: "pendiente",
  responsable: "ambos",
};
const nombre = () => "Los dos";

describe("tareasIcs", () => {
  it("un evento de día completo por tarea con fecha", () => {
    const ics = tareasIcs([base, { ...base, id: "t2", fecha_limite: null }], nombre, new Date("2026-01-01T00:00:00Z"));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("UID:t1@nosotros");
    expect(ics).toContain("DTSTAMP:20260101T000000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("marca las hechas y escapa el texto", () => {
    const ics = tareasIcs([{ ...base, estado: "hecha", titulo: "Flores, velas; etc", descripcion: "a\nb" }], nombre);
    expect(ics).toContain("SUMMARY:✓ Flores\\, velas\; etc");
    expect(ics).toContain("DESCRIPTION:a\\nb\\nResponsable: Los dos");
  });

  it("pliega las líneas largas a 75 bytes", () => {
    const ics = tareasIcs([{ ...base, titulo: "ñ".repeat(100) }], nombre);
    for (const linea of ics.split("\r\n")) expect(Buffer.byteLength(linea)).toBeLessThanOrEqual(75);
  });
});
