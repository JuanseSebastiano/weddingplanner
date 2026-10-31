"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MOMENTOS, youtubeUrl, type Momento } from "@/lib/musica";
import { agregarCancion, borrarCancion, importarPlaylist, moverCancion, reordenarCancion } from "./actions";

type Cancion = {
  id: string;
  momento: string;
  orden: number;
  titulo: string;
  artista: string | null;
  spotify_id: string | null;
  spotify_url: string | null;
  preview_url: string | null;
  portada_url: string | null;
};

/** La banda sonora de la boda, momento por momento, con preview para escuchar. */
export function Musica({
  canciones,
  spotify,
  conectado,
  errorSpotify,
}: {
  canciones: Cancion[];
  spotify: boolean;
  conectado: boolean;
  errorSpotify: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState<string | null>(null);
  const [embed, setEmbed] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function play(c: Cancion) {
    const a = audio.current!;
    if (sonando === c.id) {
      a.pause();
      setSonando(null);
      return;
    }
    if (c.preview_url) {
      setEmbed(null);
      a.src = c.preview_url;
      void a.play();
      setSonando(c.id);
    } else if (c.spotify_id) {
      // Sin preview de iTunes: el reproductor de Spotify trae 30 s sin login.
      a.pause();
      setSonando(null);
      setEmbed(embed === c.id ? null : c.id);
    }
  }

  function importar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    startTransition(async () => {
      const r = await importarPlaylist(link);
      if ("error" in r && r.error) setMensaje(r.error);
      else {
        setMensaje(`Importadas ${r.importadas}${r.repetidas ? ` · ${r.repetidas} ya estaban` : ""}. Están en "Sin asignar".`);
        setLink("");
      }
    });
  }

  function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    startTransition(async () => {
      const r = await agregarCancion({
        titulo: String(f.get("titulo")).trim(),
        artista: String(f.get("artista")).trim() || null,
        momento: String(f.get("momento")) as Momento,
      });
      if (r.error) setMensaje(r.error);
      else form.reset();
    });
  }

  const accion = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMensaje(r.error);
    });

  return (
    <main className="pb-20">
      <h1 className="font-serif text-2xl font-normal lg:text-[28px]">Música</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {canciones.length} canciones · tocá ▶ para escuchar 30 segundos.
      </p>
      <audio ref={audio} onEnded={() => setSonando(null)} className="hidden" />

      {spotify && !conectado ? (
        <div className="mt-4">
          <Button asChild>
            <a href="/api/spotify/login">Conectar Spotify</a>
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Para importar playlists, Spotify pide entrar con la cuenta dueña de la playlist (o que colabore en ella).
          </p>
          {errorSpotify && <p className="mt-1 text-sm text-danger">No se pudo conectar Spotify. Probá de nuevo.</p>}
        </div>
      ) : (
        <form onSubmit={importar} className="mt-4 flex gap-2">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link de una playlist de Spotify"
            disabled={!spotify}
          />
          <Button type="submit" disabled={!spotify || !link || pendiente}>
            {pendiente ? "Importando…" : "Importar"}
          </Button>
        </form>
      )}
      {!spotify && (
        <p className="mt-1 text-xs text-muted-foreground">
          Para importar de Spotify falta cargar SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en Vercel. Mientras, podés
          sumar canciones a mano abajo.
        </p>
      )}
      {mensaje && <p className="mt-2 text-sm text-muted-foreground">{mensaje}</p>}

      <div className="mt-5 space-y-4">
        {MOMENTOS.map((m) => {
          const lista = canciones.filter((c) => c.momento === m.id);
          if (lista.length === 0 && m.id === "sin_asignar") return null;
          return (
            <section key={m.id} className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
              <h2 className="font-serif text-lg font-normal">
                {m.label} <span className="text-sm text-muted-foreground">· {lista.length}</span>
              </h2>
              {lista.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Todavía sin canciones.</p>}
              <ul className="mt-2 divide-y divide-border-soft">
                {lista.map((c, i) => (
                  <li key={c.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      {c.portada_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.portada_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-base">{c.titulo}</p>
                        {c.artista && <p className="truncate text-sm text-muted-foreground">{c.artista}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {(c.preview_url || c.spotify_id) && (
                            <button
                              onClick={() => play(c)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                                sonando === c.id || embed === c.id
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {sonando === c.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              Preview
                            </button>
                          )}
                          {c.spotify_url && (
                            <a href={c.spotify_url} target="_blank" rel="noreferrer" className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                              Spotify
                            </a>
                          )}
                          <a
                            href={youtubeUrl(c.titulo, c.artista)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-2.5 py-0.5 text-xs"
                          >
                            YT
                          </a>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <select
                          aria-label="Momento"
                          value={c.momento}
                          disabled={pendiente}
                          onChange={(e) => accion(() => moverCancion(c.id, e.target.value as Momento))}
                          className="h-7 max-w-[8.5rem] rounded-lg border border-input bg-card px-1.5 text-xs"
                        >
                          {MOMENTOS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-0.5">
                          <button aria-label="Subir" disabled={i === 0 || pendiente} onClick={() => accion(() => reordenarCancion(c.id, -1))} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button aria-label="Bajar" disabled={i === lista.length - 1 || pendiente} onClick={() => accion(() => reordenarCancion(c.id, 1))} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            aria-label="Borrar"
                            disabled={pendiente}
                            onClick={() => confirm(`¿Borrar "${c.titulo}"?`) && accion(() => borrarCancion(c.id))}
                            className="rounded p-1 text-danger hover:bg-muted"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {embed === c.id && c.spotify_id && (
                      <iframe
                        title={`Spotify: ${c.titulo}`}
                        src={`https://open.spotify.com/embed/track/${c.spotify_id}`}
                        className="mt-2 h-20 w-full rounded-xl border-0"
                        allow="encrypted-media"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <form onSubmit={agregar} className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-dashed border-border p-3.5">
        <Input name="titulo" placeholder="Canción" required className="min-w-[10rem] flex-1" />
        <Input name="artista" placeholder="Artista" className="min-w-[8rem] flex-1" />
        <select name="momento" defaultValue="fiesta" className="h-10 rounded-xl border border-input bg-card px-3 text-sm">
          {MOMENTOS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pendiente}>
          Agregar
        </Button>
      </form>
    </main>
  );
}
