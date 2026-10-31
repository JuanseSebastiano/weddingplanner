/**
 * Geometría del plano de la carpa. Todo en metros; x/y es el centro de
 * cada elemento, medido desde la esquina superior izquierda.
 */

export const CARPA = { ancho: 16, largo: 16 } as const;
/** Pasillo mínimo entre elementos para considerarlos separados. */
export const MARGEN = 0.1;

export type Forma = "redonda" | "rectangular";

export interface Pieza {
  x: number;
  y: number;
  ancho: number;
  largo: number;
  forma: Forma;
}

const redondear = (n: number) => Math.round(n * 10) / 10;

/** Mantiene la pieza adentro de la carpa y redondea a 10 cm. */
export function dentroDeCarpa(p: Pieza): { x: number; y: number } {
  const mx = Math.min(p.ancho / 2, CARPA.ancho / 2);
  const my = Math.min(p.largo / 2, CARPA.largo / 2);
  return {
    x: redondear(Math.min(CARPA.ancho - mx, Math.max(mx, p.x))),
    y: redondear(Math.min(CARPA.largo - my, Math.max(my, p.y))),
  };
}

/** ¿Se pisan? Las redondas se tratan como círculo, el resto como rectángulo. */
export function seSuperponen(a: Pieza, b: Pieza): boolean {
  if (a.forma === "redonda" && b.forma === "redonda") {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return d < a.ancho / 2 + b.ancho / 2 - MARGEN;
  }
  if (a.forma === "redonda" || b.forma === "redonda") {
    const [c, r] = a.forma === "redonda" ? [a, b] : [b, a];
    const px = Math.max(r.x - r.ancho / 2, Math.min(c.x, r.x + r.ancho / 2));
    const py = Math.max(r.y - r.largo / 2, Math.min(c.y, r.y + r.largo / 2));
    return Math.hypot(c.x - px, c.y - py) < c.ancho / 2 - MARGEN;
  }
  return (
    Math.abs(a.x - b.x) < (a.ancho + b.ancho) / 2 - MARGEN &&
    Math.abs(a.y - b.y) < (a.largo + b.largo) / 2 - MARGEN
  );
}

/** Posiciones de las sillas alrededor de la mesa, relativas a su centro. */
export function sillas(p: Pick<Pieza, "ancho" | "largo" | "forma">, cantidad: number): { x: number; y: number }[] {
  if (cantidad <= 0) return [];
  const sep = 0.3;
  if (p.forma === "redonda") {
    const r = p.ancho / 2 + sep;
    return Array.from({ length: cantidad }, (_, i) => {
      const a = (2 * Math.PI * i) / cantidad - Math.PI / 2;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    });
  }
  // Rectangular: se reparten en los dos lados largos.
  const horizontal = p.ancho >= p.largo;
  const lado = horizontal ? p.ancho : p.largo;
  const porLado = Math.ceil(cantidad / 2);
  return Array.from({ length: cantidad }, (_, i) => {
    const fila = i < porLado ? -1 : 1;
    const k = i < porLado ? i : i - porLado;
    const n = i < porLado ? porLado : cantidad - porLado;
    const t = -lado / 2 + (lado * (k + 0.5)) / n;
    const d = (horizontal ? p.largo : p.ancho) / 2 + sep;
    return horizontal ? { x: t, y: fila * d } : { x: fila * d, y: t };
  });
}

/** Primer lugar libre recorriendo la carpa en una grilla de 50 cm. */
export function lugarLibre(nueva: Omit<Pieza, "x" | "y">, ocupadas: Pieza[]): { x: number; y: number } | null {
  for (let y = nueva.largo / 2; y <= CARPA.largo - nueva.largo / 2; y += 0.5) {
    for (let x = nueva.ancho / 2; x <= CARPA.ancho - nueva.ancho / 2; x += 0.5) {
      const p = { ...nueva, x, y };
      if (!ocupadas.some((o) => seSuperponen(p, o))) return dentroDeCarpa(p);
    }
  }
  return null;
}
