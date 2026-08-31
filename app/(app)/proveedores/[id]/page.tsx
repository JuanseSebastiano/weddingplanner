import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { FichaVendor } from "./ficha";
import type { Vendor } from "../form-vendor";
import type { Quote } from "./ficha";

export default async function VendorPage({ params }: PageProps<"/proveedores/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const wedding = await getWedding();

  const [{ data: vendor }, { data: quotes }, { data: tareas }, { data: items }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select(
          "id, nombre, rubro, contacto, telefono, web_ig, estado, rating, notas",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("quotes")
        .select(
          "id, vendor_id, monto, moneda, incluye, excluye, valido_hasta, archivo_path, estado",
        )
        .eq("vendor_id", id)
        .order("monto"),
      supabase
        .from("tasks")
        .select("id, titulo, estado, fecha_limite")
        .eq("vendor_id", id)
        .order("fecha_limite", { nullsFirst: false }),
      supabase
        .from("budget_items")
        .select("id, concepto, monto_estimado, monto_real, moneda")
        .eq("vendor_id", id),
    ]);

  if (!vendor) notFound();

  return (
    <FichaVendor
      vendor={vendor as Vendor}
      quotes={(quotes ?? []) as Quote[]}
      tareas={tareas ?? []}
      items={items ?? []}
      cotizacion={wedding.cotizacion_referencia}
    />
  );
}
