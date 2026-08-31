"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";

export type NuevoInvitado = {
  nombre: string;
  grupo: string | null;
  lado: "novio" | "novia";
  email: string | null;
  telefono: string | null;
  rsvp: "pendiente" | "confirmado" | "rechazado";
  acompanantes: number;
  menu: "ninguno" | "vegetariano" | "celiaco" | "otro";
  menu_detalle: string | null;
  alojamiento: boolean;
  notas: string | null;
};

export async function crearInvitado(datos: NuevoInvitado) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("guests")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidatePath("/invitados");
  revalidatePath("/mesas");
  return {};
}

export async function actualizarInvitado(
  id: string,
  campos: Partial<NuevoInvitado & { table_id: string | null }>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invitados");
  revalidatePath("/mesas");
  return {};
}

export async function borrarInvitado(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/invitados");
  revalidatePath("/mesas");
  return {};
}

export async function importarInvitados(filas: NuevoInvitado[]) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error, count } = await supabase
    .from("guests")
    .insert(
      filas.map((f) => ({ ...f, wedding_id: wedding.id })),
      { count: "exact" },
    );

  if (error) return { error: error.message };
  revalidatePath("/invitados");
  revalidatePath("/mesas");
  return { importados: count ?? filas.length };
}
