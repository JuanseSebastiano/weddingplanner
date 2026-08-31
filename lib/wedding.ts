import { createClient } from "@/lib/supabase/server";

export type Wedding = {
  id: string;
  fecha: string;
  lugar: string;
  presupuesto_objetivo: number;
  moneda_base: "ARS" | "USD";
  cotizacion_referencia: number;
};

/** La boda del usuario logueado. RLS garantiza que sólo vea la suya. */
export async function getWedding() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weddings")
    .select(
      "id, fecha, lugar, presupuesto_objetivo, moneda_base, cotizacion_referencia",
    )
    .limit(1)
    .single();

  if (error) throw new Error(`No se pudo cargar la boda: ${error.message}`);
  return data as Wedding;
}
