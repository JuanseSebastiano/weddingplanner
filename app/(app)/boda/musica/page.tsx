import { createClient } from "@/lib/supabase/server";
import { spotifyConfigurado } from "@/lib/spotify";
import { Musica } from "./musica";

export default async function MusicaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wedding_songs")
    .select("id, momento, orden, titulo, artista, spotify_id, spotify_url, preview_url, portada_url")
    .order("orden")
    .order("created_at");

  return <Musica canciones={data ?? []} spotify={spotifyConfigurado()} />;
}
