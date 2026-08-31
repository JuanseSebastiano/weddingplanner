"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import type { Rubro } from "@/lib/format";

export type DatosVendor = {
  nombre: string;
  rubro: Rubro;
  contacto: string | null;
  telefono: string | null;
  web_ig: string | null;
  estado: "contactado" | "presupuesto_recibido" | "contratado" | "descartado";
  rating: number | null;
  notas: string | null;
};

export async function crearVendor(datos: DatosVendor) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { data, error } = await supabase
    .from("vendors")
    .insert({ ...datos, wedding_id: wedding.id })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/proveedores");
  return { id: data.id };
}

export async function actualizarVendor(
  id: string,
  campos: Partial<DatosVendor>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  revalidatePath("/comparador");
  return {};
}

export async function borrarVendor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/proveedores");
  revalidatePath("/comparador");
  return {};
}

export type DatosQuote = {
  vendor_id: string;
  monto: number;
  moneda: "ARS" | "USD";
  incluye: string | null;
  excluye: string | null;
  valido_hasta: string | null;
  estado: "recibido" | "aceptado" | "rechazado" | "vencido";
};

export async function crearQuote(datos: DatosQuote) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("quotes")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${datos.vendor_id}`);
  revalidatePath("/comparador");
  return {};
}

export async function actualizarQuote(
  id: string,
  vendorId: string,
  campos: Partial<DatosQuote>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${vendorId}`);
  revalidatePath("/comparador");
  return {};
}

export async function borrarQuote(id: string, vendorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${vendorId}`);
  revalidatePath("/comparador");
  return {};
}

/** Adjunta el PDF o la foto del presupuesto. */
export async function subirArchivoQuote(
  quoteId: string,
  vendorId: string,
  archivo: File,
) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const ext = archivo.name.split(".").pop() ?? "bin";
  const path = `${wedding.id}/presupuestos/${quoteId}.${ext}`;

  const { error: errorSubida } = await supabase.storage
    .from("files")
    .upload(path, archivo, { upsert: true });

  if (errorSubida) return { error: errorSubida.message };

  const { error } = await supabase
    .from("quotes")
    .update({ archivo_path: path })
    .eq("id", quoteId);

  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${vendorId}`);
  return {};
}
