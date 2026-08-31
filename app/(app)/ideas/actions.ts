"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import type { Rubro } from "@/lib/format";

export type DatosIdea = {
  titulo: string;
  descripcion: string | null;
  categoria: Rubro;
  links: string[];
  estado: "idea" | "evaluando" | "aprobada" | "descartada";
};

export async function crearIdea(datos: DatosIdea) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { data, error } = await supabase
    .from("ideas")
    .insert({ ...datos, wedding_id: wedding.id })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return { id: data.id };
}

export async function actualizarIdea(id: string, campos: Partial<DatosIdea>) {
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").update(campos).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return {};
}

export async function borrarIdea(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return {};
}

/** Las imágenes de una idea se guardan como documentos ligados a ella. */
export async function subirImagenIdea(ideaId: string, archivo: File) {
  const supabase = await createClient();
  const wedding = await getWedding();

  const ext = archivo.name.split(".").pop() ?? "jpg";
  const path = `${wedding.id}/ideas/${ideaId}-${Date.now()}.${ext}`;

  const { error: errorSubida } = await supabase.storage
    .from("files")
    .upload(path, archivo);

  if (errorSubida) return { error: errorSubida.message };

  const { error } = await supabase.from("documents").insert({
    wedding_id: wedding.id,
    entidad: "idea",
    entidad_id: ideaId,
    nombre: archivo.name,
    path,
    mime: archivo.type,
  });

  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return {};
}

export async function borrarImagenIdea(documentId: string, path: string) {
  const supabase = await createClient();

  await supabase.storage.from("files").remove([path]);
  const { error } = await supabase.from("documents").delete().eq("id", documentId);

  if (error) return { error: error.message };
  revalidatePath("/ideas");
  return {};
}
