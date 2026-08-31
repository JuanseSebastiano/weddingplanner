/** Formatos rioplatenses: fechas dd/mm/aaaa y miles con punto. */

export function formatFecha(fecha: string | null | undefined) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Fecha ISO (aaaa-mm-dd) de hoy en horario de Argentina. */
export function hoyISO() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function formatMonto(monto: number, moneda: "ARS" | "USD") {
  const n = Math.round(monto).toLocaleString("es-AR");
  return moneda === "USD" ? `US$ ${n}` : `$ ${n}`;
}

/** Convierte un monto a USD usando la cotización dada (ARS por 1 USD). */
export function aUSD(monto: number, moneda: "ARS" | "USD", cotizacion: number) {
  return moneda === "USD" ? monto : monto / cotizacion;
}

export function aARS(monto: number, moneda: "ARS" | "USD", cotizacion: number) {
  return moneda === "ARS" ? monto : monto * cotizacion;
}

export function diasHasta(fecha: string) {
  const hoy = new Date(hoyISO() + "T00:00:00");
  const objetivo = new Date(fecha.slice(0, 10) + "T00:00:00");
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
}

export const RUBROS = [
  "catering",
  "fotografia",
  "musica",
  "salon",
  "decoracion",
  "vestimenta",
  "transporte",
  "civil_iglesia",
  "otros",
] as const;

export type Rubro = (typeof RUBROS)[number];

export const RUBRO_LABEL: Record<Rubro, string> = {
  catering: "Catering",
  fotografia: "Fotografía",
  musica: "Música",
  salon: "Salón",
  decoracion: "Decoración",
  vestimenta: "Vestimenta",
  transporte: "Transporte",
  civil_iglesia: "Civil / Iglesia",
  otros: "Otros",
};
