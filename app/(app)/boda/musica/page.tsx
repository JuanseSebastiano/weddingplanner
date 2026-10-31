import { createClient } from "@/lib/supabase/server";
import { spotifyConectado, spotifyConfigurado } from "@/lib/spotify";
import { Musica } from "./musica";

export default async function MusicaPage({ searchParams }: PageProps<"/boda/musica">) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_songs")
    .select("id, momento, orden, titulo, artista, spotify_id, spotify_url, preview_url, portada_url")
    .order("orden")
    .order("created_at");

  const { data: coupleId } = await supabase.rpc("my_couple_id");
  const conectado = spotifyConfigurado() && coupleId ? await spotifyConectado(coupleId) : false;

  return (
    <Musica
      canciones={data ?? []}
      spotify={spotifyConfigurado()}
      conectado={conectado}
      errorSpotify={(await searchParams).spotify === "error"}
    />
  );
}
