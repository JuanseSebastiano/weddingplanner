"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { tareasDesdePlantilla } from "@/lib/plantilla-tareas";
import { hoyISO, type Rubro } from "@/lib/format";

export type DatosTarea = {
  titulo: string;
  descripcion: string | null;
  categoria: Rubro;
  responsable: "novio" | "novia" | "ambos";
  fecha_limite: string | null;
  prioridad: "alta" | "media" | "baja";
  estado: "pendiente" | "en_curso" | "hecha";
  depende_de: string | null;
  vendor_id: string | null;
};

export async function crearTarea(datos: DatosTarea) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("wedding_tasks")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidatePath("/boda/tareas");
  revalidatePath("/boda");
  return {};
}

export async function actualizarTarea(id: string, campos: Partial<DatosTarea>) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_tasks").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/boda/tareas");
  revalidatePath("/boda");
  return {};
}

export async function borrarTarea(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_tasks").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/boda/tareas");
  revalidatePath("/boda");
  return {};
}

/** Siembra el checklist estándar. Sólo agrega las que todavía no existen. */
export async function sembrarChecklist() {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { data: existentes } = await supabase.from("wedding_tasks").select("titulo");
  const yaEstan = new Set((existentes ?? []).map((t) => t.titulo));

  const nuevas = tareasDesdePlantilla(wedding.fecha, hoyISO())
    .filter((t) => !yaEstan.has(t.titulo))
    .map((t) => ({ ...t, wedding_id: wedding.id }));

  if (nuevas.length === 0) return { creadas: 0 };

  const { error } = await supabase.from("wedding_tasks").insert(nuevas);
  if (error) return { error: error.message };

  revalidatePath("/boda/tareas");
  revalidatePath("/boda");
  return { creadas: nuevas.length };
}

export async function crearEventoAgenda(datos: {
  hora: string;
  actividad: string;
  responsable: string | null;
  notas: string | null;
}) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { error } = await supabase
    .from("wedding_timeline_events")
    .insert({ ...datos, wedding_id: wedding.id });

  if (error) return { error: error.message };
  revalidatePath("/boda/agenda-del-dia");
  return {};
}

export async function actualizarEventoAgenda(
  id: string,
  campos: {
    hora?: string;
    actividad?: string;
    responsable?: string | null;
    notas?: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_timeline_events")
    .update(campos)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/boda/agenda-del-dia");
  return {};
}

export async function borrarEventoAgenda(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_timeline_events")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/boda/agenda-del-dia");
  return {};
}
