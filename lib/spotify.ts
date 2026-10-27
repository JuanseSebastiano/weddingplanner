/**
 * Spotify Web API con client credentials (solo servidor): alcanza para leer
 * playlists públicas. Spotify ya no devuelve `preview_url` a las apps
 * nuevas, así que el preview se busca en la iTunes Search API.
 */

let cache: { token: string; vence: number } | null = null;

export function spotifyConfigurado(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function token(): Promise<string> {
  if (cache && cache.vence > Date.now()) return cache.token;
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify rechazó las credenciales (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: data.access_token, vence: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
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

/** Todos los temas de una playlist pública, paginando de a 100. */
export async function temasDePlaylist(id: string): Promise<Tema[]> {
  const auth = { Authorization: `Bearer ${await token()}` };
  const temas: Tema[] = [];
  let url: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;

  while (url) {
    const res: Response = await fetch(url, { headers: auth });
    if (res.status === 404) throw new Error("No encontramos la playlist. ¿Es pública?");
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

/** Preview de 30 s de la iTunes Search API. null si no lo encuentra. */
export async function previewItunes(titulo: string, artista: string | null): Promise<{ preview: string; portada: string | null } | null> {
  const term = encodeURIComponent([titulo, artista].filter(Boolean).join(" "));
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
