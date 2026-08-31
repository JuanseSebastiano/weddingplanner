import type { Rubro } from "@/lib/format";

export type Item = {
  id: string;
  categoria: Rubro;
  concepto: string;
  monto_estimado: number;
  monto_real: number | null;
  moneda: "ARS" | "USD";
  vendor_id: string | null;
};

export type Pago = {
  id: string;
  budget_item_id: string;
  monto: number;
  moneda: "ARS" | "USD";
  cotizacion_usd: number | null;
  fecha: string;
  medio_pago: string | null;
  tipo: "sena" | "cuota" | "saldo";
  comprobante_path: string | null;
  pagado: boolean;
};

export type Par = { usd: number; ars: number };

/** Todo monto se guarda en su moneda; acá se expresa en las dos. */
export function enAmbas(
  monto: number,
  moneda: "ARS" | "USD",
  cotizacion: number,
): Par {
  return moneda === "USD"
    ? { usd: monto, ars: monto * cotizacion }
    : { usd: monto / cotizacion, ars: monto };
}

export function sumar(a: Par, b: Par): Par {
  return { usd: a.usd + b.usd, ars: a.ars + b.ars };
}

export const CERO: Par = { usd: 0, ars: 0 };

/** Los pagos en USD guardan la cotización de ese día; el resto usa la de referencia. */
export function pagoEnAmbas(pago: Pago, cotizacionReferencia: number): Par {
  return enAmbas(
    pago.monto,
    pago.moneda,
    pago.cotizacion_usd ?? cotizacionReferencia,
  );
}

export type ItemCalculado = {
  item: Item;
  estimado: Par;
  previsto: Par;
  pagado: Par;
  pendiente: Par;
  excedido: boolean;
};

export function calcularItem(
  item: Item,
  pagos: Pago[],
  cotizacion: number,
): ItemCalculado {
  const estimado = enAmbas(item.monto_estimado, item.moneda, cotizacion);
  const previsto = enAmbas(
    item.monto_real ?? item.monto_estimado,
    item.moneda,
    cotizacion,
  );

  const pagado = pagos
    .filter((p) => p.budget_item_id === item.id && p.pagado)
    .reduce((acc, p) => sumar(acc, pagoEnAmbas(p, cotizacion)), CERO);

  return {
    item,
    estimado,
    previsto,
    pagado,
    pendiente: {
      usd: Math.max(0, previsto.usd - pagado.usd),
      ars: Math.max(0, previsto.ars - pagado.ars),
    },
    // "Se pasó" = lo que realmente cuesta superó lo que habíamos estimado.
    excedido: previsto.usd > estimado.usd + 0.01,
  };
}

export type CategoriaCalculada = {
  categoria: Rubro;
  items: ItemCalculado[];
  estimado: Par;
  previsto: Par;
  pagado: Par;
  pendiente: Par;
  excedido: boolean;
};

export function agruparPorCategoria(
  items: Item[],
  pagos: Pago[],
  cotizacion: number,
): CategoriaCalculada[] {
  const calculados = items.map((i) => calcularItem(i, pagos, cotizacion));
  const categorias = [...new Set(items.map((i) => i.categoria))];

  return categorias
    .map((categoria) => {
      const propios = calculados.filter((c) => c.item.categoria === categoria);
      const total = (campo: "estimado" | "previsto" | "pagado" | "pendiente") =>
        propios.reduce((acc, c) => sumar(acc, c[campo]), CERO);

      const estimado = total("estimado");
      const previsto = total("previsto");

      return {
        categoria,
        items: propios,
        estimado,
        previsto,
        pagado: total("pagado"),
        pendiente: total("pendiente"),
        excedido: previsto.usd > estimado.usd + 0.01,
      };
    })
    .sort((a, b) => b.previsto.usd - a.previsto.usd);
}

/** Serie de gasto acumulado, un punto por día con pagos. */
export function gastoAcumulado(pagos: Pago[], cotizacion: number) {
  const porFecha = new Map<string, number>();

  for (const p of pagos.filter((p) => p.pagado)) {
    const { usd } = pagoEnAmbas(p, cotizacion);
    porFecha.set(p.fecha, (porFecha.get(p.fecha) ?? 0) + usd);
  }

  let acumulado = 0;
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, monto]) => {
      acumulado += monto;
      return { fecha, acumulado };
    });
}
