import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Comparador, type QuoteConVendor } from "./comparador";

export default async function ComparadorPage() {
  const supabase = await createClient();

  const [wedding, { data }] = await Promise.all([
    getWedding(),
    supabase
      .from("quotes")
      .select(
        "id, monto, moneda, incluye, excluye, valido_hasta, estado, vendors(id, nombre, rubro, rating, estado)",
      )
      .order("monto"),
  ]);

  return (
    <Comparador
      quotes={(data ?? []) as unknown as QuoteConVendor[]}
      cotizacion={wedding.cotizacion_referencia}
    />
  );
}
