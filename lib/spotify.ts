import { supabaseAdmin } from "@/lib/finanzas/server/lib/supabase";

/**
 * Spotify Web API con la cuenta de la pareja (solo servidor). Desde febrero
 * de 2026 Spotify no deja leer playlists con client credentials: hace falta
 * el token de alguien dueño o colaborador de la playlist. Spotify ya no
 * devuelve `preview_url` a las apps nuevas, así que el preview se busca en
 * la iTunes Search API.
 */

export function spotifyConfigurado(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function spotifyBasicAuth(): string {
  return `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`;
}

/** Tiene que estar cargada tal cual en el dashboard de Spotify (Redirect URIs). */
export function spotifyRedirectUri(request: Request): string {
  return `${new URL(request.url).origin}/api/spotify/callback`;
}

export async function spotifyConectado(coupleId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("wedding_spotify").select("couple_id").eq("couple_id", coupleId).maybeSingle();
  return Boolean(data);
}

/** Access token de la pareja a partir del refresh token guardado. */
async function token(coupleId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("wedding_spotify")
    .select("refresh_token")
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conectá Spotify para importar playlists.");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: spotifyBasicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  if (!res.ok) throw new Error("Spotify rechazó el permiso guardado. Volvé a conectar Spotify.");
  const tokens = (await res.json()) as { access_token: string; refresh_token?: string };

  // Spotify a veces rota el refresh token.
  if (tokens.refresh_token && tokens.refresh_token !== data.refresh_token) {
    await supabaseAdmin
      .from("wedding_spotify")
      .update({ refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() })
      .eq("couple_id", coupleId);
  }
  return tokens.access_token;
}

export interface Tema {
  spotify_id: string;
  titulo: string;
  artista: string;
  spotify_url: string;
  portada_url: string | null;
  duracion_ms: number;
  preview_url: string | null;
}

interface SpotifyTrack {
  id: string | null;
  name: string;
  type?: string;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  external_urls?: { spotify?: string };
}

/** Todos los temas de una playlist propia o en la que se colabora, paginando de a 50. */
export async function temasDePlaylist(coupleId: string, id: string): Promise<Tema[]> {
  const auth = { Authorization: `Bearer ${await token(coupleId)}` };
  const temas: Tema[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${id}/items?limit=50`;

  while (url) {
    const res: Response = await fetch(url, { headers: auth });
    if (res.status === 404) throw new Error("No encontramos la playlist.");
    if (res.status === 403)
      throw new Error("Spotify solo deja importar playlists de la cuenta conectada o en las que colabora.");
    if (!res.ok) throw new Error(`Spotify respondió ${res.status} al leer la playlist`);
    const page = (await res.json()) as {
      items: { track?: SpotifyTrack | null; item?: SpotifyTrack | null }[];
      next: string | null;
    };
    for (const row of page.items) {
      const t = row.track ?? row.item;
      if (!t?.id || (t.type && t.type !== "track")) continue;
      temas.push({
        spotify_id: t.id,
        titulo: t.name,
        artista: t.artists.map((a) => a.name).join(", "),
        spotify_url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
        portada_url: t.album?.images?.at(-1)?.url ?? t.album?.images?.[0]?.url ?? null,
        duracion_ms: t.duration_ms,
        preview_url: t.preview_url,
      });
    }
    url = page.next;
  }
  return temas;
}

/**
 * Preview de 30 s de la iTunes Search API. null si no lo encuentra. Busca
 * con el título sin versión ("- Ao Vivo", "(Live)") y el primer artista.
 */
export async function previewItunes(titulo: string, artista: string | null): Promise<{ preview: string; portada: string | null } | null> {
  const limpio = titulo.replace(/\s+-\s+.*$/, "").replace(/\s*[([].*?[)\]]/g, "").trim() || titulo;
  const primero = artista?.split(",")[0].trim() || null;
  const term = encodeURIComponent([limpio, primero].filter(Boolean).join(" "));
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { previewUrl?: string; artworkUrl100?: string }[] };
    const r = data.results?.[0];
    return r?.previewUrl ? { preview: r.previewUrl, portada: r.artworkUrl100 ?? null } : null;
  } catch {
    return null;
  }
}
