import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { spotifyRedirectUri } from "@/lib/spotify";

/** Manda a Spotify a pedir permiso para leer las playlists de la persona. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const state = randomUUID();
  (await cookies()).set("spotify_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(request),
    scope: "playlist-read-private playlist-read-collaborative",
    state,
  });
  redirect(`https://accounts.spotify.com/authorize?${params}`);
}
