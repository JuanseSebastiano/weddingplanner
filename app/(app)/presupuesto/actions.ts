"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import type { Rubro } from "@/lib/format";

function revalidarPlata() {
  revalidatePath("/presupuesto");
  revalidatePath("/pagos");
  revalidatePath("/");
}

export async function crearItem(datos: {
  categoria: Rubro;
  concepto: string;
  monto_estimado: number;
  monto_real: number | null;
  moneda: "ARS" | "USD";
  vendor_id: string | null;
}) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("budget_items")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function actualizarItem(
  id: string,
  campos: {
    categoria?: Rubro;
    concepto?: string;
    monto_estimado?: number;
    monto_real?: number | null;
    moneda?: "ARS" | "USD";
    vendor_id?: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_items")
    .update(campos)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function borrarItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function guardarCotizacionReferencia(cotizacion: number) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("weddings")
    .update({ cotizacion_referencia: cotizacion })
    .eq("id", wedding.id);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function crearPago(datos: {
  budget_item_id: string;
  monto: number;
  moneda: "ARS" | "USD";
  cotizacion_usd: number | null;
  fecha: string;
  medio_pago: string | null;
  tipo: "sena" | "cuota" | "saldo";
  pagado: boolean;
}) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("payments")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function actualizarPago(
  id: string,
  campos: {
    monto?: number;
    moneda?: "ARS" | "USD";
    cotizacion_usd?: number | null;
    fecha?: string;
    medio_pago?: string | null;
    tipo?: "sena" | "cuota" | "saldo";
    pagado?: boolean;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

export async function borrarPago(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

/** Sube el comprobante al bucket privado y lo deja apuntado en el pago. */
export async function subirComprobante(pagoId: string, archivo: File) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const ext = archivo.name.split(".").pop() ?? "bin";
  const path = `${wedding.id}/comprobantes/${pagoId}.${ext}`;

  const { error: errorSubida } = await supabase.storage
    .from("files")
    .upload(path, archivo, { upsert: true });

  if (errorSubida) return { error: errorSubida.message };

  const { error } = await supabase
    .from("payments")
    .update({ comprobante_path: path })
    .eq("id", pagoId);

  if (error) return { error: error.message };
  revalidarPlata();
  return {};
}

/** URL temporal para ver un archivo del bucket privado. */
export async function urlDeArchivo(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(path, 60 * 10);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
