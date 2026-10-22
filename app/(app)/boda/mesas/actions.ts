"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";

export async function crearMesa(datos: {
  numero: number;
  capacidad: number;
  ubicacion: string | null;
}) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("wedding_tables")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una mesa con ese número."
          : error.message,
    };
  }
  revalidatePath("/boda/mesas");
  return {};
}

export async function actualizarMesa(
  id: string,
  campos: {
    numero?: number;
    capacidad?: number;
    ubicacion?: string | null;
    forma?: "redonda" | "rectangular";
    ancho?: number;
    largo?: number;
    x?: number | null;
    y?: number | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_tables").update(campos).eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una mesa con ese número."
          : error.message,
    };
  }
  revalidatePath("/boda/mesas");
  return {};
}

export async function borrarMesa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_tables").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/boda/mesas");
  revalidatePath("/boda/invitados");
  return {};
}

/** Asigna (o saca, con tableId null) varios invitados de una. */
export async function asignarAMesa(guestIds: string[], tableId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_guests")
    .update({ table_id: tableId })
    .in("id", guestIds);

  if (error) return { error: error.message };
  revalidatePath("/boda/mesas");
  revalidatePath("/boda/invitados");
  return {};
}

/** Pista, DJ y demás elementos del plano que no son mesas. */
export async function actualizarElemento(
  id: string,
  campos: { x?: number; y?: number; ancho?: number; largo?: number; nombre?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_layout_items").update(campos).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boda/mesas");
  return {};
}

/** La primera vez que se abre el plano: pista 5×5 m al centro y DJ 2×1 m al fondo. */
export async function crearElementosBase() {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("wedding_layout_items")
    .select("id", { count: "exact", head: true });
  if (countError) return { error: countError.message };
  if (count) return {};

  const { error } = await supabase.from("wedding_layout_items").insert([
    { tipo: "pista", nombre: "Pista", x: 5, y: 7.5, ancho: 5, largo: 5 },
    { tipo: "dj", nombre: "DJ", x: 5, y: 4.3, ancho: 2, largo: 1 },
  ]);
  if (error) return { error: error.message };
  revalidatePath("/boda/mesas");
  return {};
}
