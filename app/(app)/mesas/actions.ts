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
    .from("tables")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una mesa con ese número."
          : error.message,
    };
  }
  revalidatePath("/mesas");
  return {};
}

export async function actualizarMesa(
  id: string,
  campos: { numero?: number; capacidad?: number; ubicacion?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("tables").update(campos).eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una mesa con ese número."
          : error.message,
    };
  }
  revalidatePath("/mesas");
  return {};
}

export async function borrarMesa(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/mesas");
  revalidatePath("/invitados");
  return {};
}

/** Asigna (o saca, con tableId null) varios invitados de una. */
export async function asignarAMesa(guestIds: string[], tableId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update({ table_id: tableId })
    .in("id", guestIds);

  if (error) return { error: error.message };
  revalidatePath("/mesas");
  revalidatePath("/invitados");
  return {};
}
