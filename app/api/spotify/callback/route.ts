import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/finanzas/server/lib/supabase";
import { spotifyBasicAuth, spotifyRedirectUri } from "@/lib/spotify";

/** Vuelta de Spotify: cambia el código por un refresh token y lo guarda para la pareja. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const state = cookieStore.get("spotify_state")?.value;
  cookieStore.delete("spotify_state");

  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) redirect("/boda/musica?spotify=error");

  const supabase = await createClient();
  const { data: coupleId } = await supabase.rpc("my_couple_id");
  if (!coupleId) redirect("/login");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: spotifyBasicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: spotifyRedirectUri(request) }),
  });
  if (!res.ok) redirect("/boda/musica?spotify=error");
  const tokens = (await res.json()) as { refresh_token: string };

  const { error } = await supabaseAdmin
    .from("wedding_spotify")
    .upsert({ couple_id: coupleId, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() });
  if (error) redirect("/boda/musica?spotify=error");

  redirect("/boda/musica");
}
