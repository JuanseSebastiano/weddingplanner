import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Pagos } from "./pagos";
import type { Item, Pago } from "@/lib/plata";

export default async function PagosPage() {
  const supabase = await createClient();

  const [wedding, { data: pagos }, { data: items }] = await Promise.all([
    getWedding(),
    supabase
      .from("payments")
      .select(
        "id, budget_item_id, monto, moneda, cotizacion_usd, fecha, medio_pago, tipo, comprobante_path, pagado",
      )
      .order("fecha", { ascending: false }),
    supabase
      .from("budget_items")
      .select(
        "id, categoria, concepto, monto_estimado, monto_real, moneda, vendor_id",
      )
      .order("concepto"),
  ]);

  return (
    <Pagos
      pagos={(pagos ?? []) as Pago[]}
      items={(items ?? []) as Item[]}
      cotizacion={wedding.cotizacion_referencia}
    />
  );
}
