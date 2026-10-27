/** Momentos de la fiesta, en el orden en que pasan. */
export const MOMENTOS = [
  { id: "ceremonia", label: "Ceremonia" },
  { id: "entrada", label: "Entrada" },
  { id: "vals", label: "Primer baile / Vals" },
  { id: "cena", label: "Cena" },
  { id: "fiesta", label: "Fiesta" },
  { id: "lentos", label: "Lentos" },
  { id: "cierre", label: "Cierre" },
  { id: "sin_asignar", label: "Sin asignar" },
] as const;

export type Momento = (typeof MOMENTOS)[number]["id"];

/** Id de la playlist desde un link de Spotify (con o sin /intl-xx/, ?si=…) o una URI. */
export function playlistId(link: string): string | null {
  return /playlist[/:]([A-Za-z0-9]{22})/.exec(link.trim())?.[1] ?? null;
}

/** Búsqueda en YouTube: no necesita API. */
export function youtubeUrl(titulo: string, artista: string | null): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent([titulo, artista].filter(Boolean).join(" "))}`;
}
