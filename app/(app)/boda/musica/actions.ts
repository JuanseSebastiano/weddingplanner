"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { playlistId, type Momento } from "@/lib/musica";
import { previewItunes, spotifyConfigurado, temasDePlaylist } from "@/lib/spotify";

/** Busca previews en iTunes de a varios a la vez, sin pasarse. */
async function conPreviews<T extends { titulo: string; artista: string | null; preview_url: string | null }>(temas: T[]) {
  const LOTE = 8;
  for (let i = 0; i < temas.length; i += LOTE) {
    await Promise.all(
      temas.slice(i, i + LOTE).map(async (t) => {
        if (t.preview_url) return;
        const r = await previewItunes(t.titulo, t.artista);
        if (r) t.preview_url = r.preview;
      }),
    );
  }
  return temas;
}

async function siguienteOrden(momento: Momento) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_songs")
    .select("orden")
    .eq("momento", momento)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.orden ?? -1) + 1;
}

export async function importarPlaylist(link: string) {
  if (!spotifyConfigurado()) return { error: "Falta configurar SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET." };
  const id = playlistId(link);
  if (!id) return { error: "Ese link no parece una playlist de Spotify." };

  let temas;
  try {
    temas = await conPreviews(await temasDePlaylist(id));
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data: existentes, error: exError } = await supabase.from("wedding_songs").select("spotify_id");
  if (exError) return { error: exError.message };
  const ya = new Set((existentes ?? []).map((s) => s.spotify_id));
  const nuevos = temas.filter((t) => !ya.has(t.spotify_id));

  const base = await siguienteOrden("sin_asignar");
  if (nuevos.length > 0) {
    const { error } = await supabase
      .from("wedding_songs")
      .insert(nuevos.map((t, i) => ({ ...t, momento: "sin_asignar", orden: base + i })));
    if (error) return { error: error.message };
  }
  revalidatePath("/boda/musica");
  return { importadas: nuevos.length, repetidas: temas.length - nuevos.length };
}

export async function agregarCancion(datos: { titulo: string; artista: string | null; momento: Momento }) {
  const [tema] = await conPreviews([{ ...datos, preview_url: null as string | null }]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_songs")
    .insert({ ...tema, orden: await siguienteOrden(datos.momento) });
  if (error) return { error: error.message };
  revalidatePath("/boda/musica");
  return {};
}

export async function moverCancion(id: string, momento: Momento) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_songs")
    .update({ momento, orden: await siguienteOrden(momento) })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boda/musica");
  return {};
}

/** Sube o baja una canción dentro de su momento. */
export async function reordenarCancion(id: string, direccion: -1 | 1) {
  const supabase = await createClient();
  const { data: actual } = await supabase.from("wedding_songs").select("momento").eq("id", id).single();
  if (!actual) return { error: "Canción no encontrada" };
  const { data: lista, error } = await supabase
    .from("wedding_songs")
    .select("id")
    .eq("momento", actual.momento)
    .order("orden")
    .order("created_at");
  if (error) return { error: error.message };

  const ids = (lista ?? []).map((s) => s.id);
  const i = ids.indexOf(id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const results = await Promise.all(
    ids.map((sid, orden) => supabase.from("wedding_songs").update({ orden }).eq("id", sid)),
  );
  const fallo = results.find((r) => r.error);
  if (fallo?.error) return { error: fallo.error.message };
  revalidatePath("/boda/musica");
  return {};
}

export async function borrarCancion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_songs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boda/musica");
  return {};
}
