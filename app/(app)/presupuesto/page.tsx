import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Presupuesto } from "./presupuesto";
import type { Item, Pago } from "@/lib/plata";

export default async function PresupuestoPage() {
  const supabase = await createClient();

  const [wedding, { data: items }, { data: pagos }, { data: vendors }] =
    await Promise.all([
      getWedding(),
      supabase
        .from("budget_items")
        .select(
          "id, categoria, concepto, monto_estimado, monto_real, moneda, vendor_id",
        )
        .order("concepto"),
      supabase
        .from("payments")
        .select(
          "id, budget_item_id, monto, moneda, cotizacion_usd, fecha, medio_pago, tipo, comprobante_path, pagado",
        )
        .order("fecha"),
      supabase.from("vendors").select("id, nombre").order("nombre"),
    ]);

  return (
    <Presupuesto
      objetivo={wedding.presupuesto_objetivo}
      monedaBase={wedding.moneda_base}
      cotizacion={wedding.cotizacion_referencia}
      items={(items ?? []) as Item[]}
      pagos={(pagos ?? []) as Pago[]}
      vendors={vendors ?? []}
    />
  );
}
