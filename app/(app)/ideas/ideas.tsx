"use client";

import { useState, useTransition } from "react";
import { Plus, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { RUBROS, RUBRO_LABEL, type Rubro } from "@/lib/format";
import {
  crearIdea,
  actualizarIdea,
  borrarIdea,
  subirImagenIdea,
  borrarImagenIdea,
  type DatosIdea,
} from "./actions";

export type Idea = DatosIdea & { id: string };

type Imagen = { id: string; path: string; url: string };

const ESTADO_LABEL = {
  idea: "Idea",
  evaluando: "Evaluando",
  aprobada: "Aprobada",
  descartada: "Descartada",
} as const;

const ESTADO_COLOR = {
  idea: "bg-muted text-muted-foreground",
  evaluando: "bg-warning/15 text-warning",
  aprobada: "bg-success/15 text-success",
  descartada: "bg-danger/10 text-danger",
} as const;

export function Ideas({
  ideas,
  imagenes,
}: {
  ideas: Idea[];
  imagenes: Record<string, Imagen[]>;
}) {
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState("");
  const [editando, setEditando] = useState<Idea | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const filtradas = ideas.filter((i) => {
    if (categoria && i.categoria !== categoria) return false;
    if (estado && i.estado !== estado) return false;
    return true;
  });

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ideas</h1>
        <Sheet open={nuevaAbierta} onOpenChange={setNuevaAbierta}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Idea
            </Button>
          </SheetTrigger>
          <SheetContent title="Nueva idea">
            <FormIdea onListo={() => setNuevaAbierta(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {ideas.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-9 w-auto text-sm"
          >
            <option value="">Toda categoría</option>
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {RUBRO_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="h-9 w-auto text-sm"
          >
            <option value="">Todo estado</option>
            {Object.entries(ESTADO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      )}

      {ideas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Todavía no guardaron ninguna idea</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es el lugar para las fotos y los links que hoy se mandan por
            WhatsApp: centros de mesa, vestidos, souvenirs. Después las marcan
            como aprobadas o descartadas.
          </p>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">
          Ninguna idea coincide con esos filtros.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {filtradas.map((idea) => {
            const fotos = imagenes[idea.id] ?? [];
            return (
              <li
                key={idea.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <button
                  onClick={() => setEditando(idea)}
                  className="w-full text-left active:bg-muted"
                >
                  {fotos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fotos[0].url}
                      alt={idea.titulo}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                      Sin foto
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="truncate font-medium">{idea.titulo}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {RUBRO_LABEL[idea.categoria]}
                    </p>
                    <span
                      className={cn(
                        "mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        ESTADO_COLOR[idea.estado],
                      )}
                    >
                      {ESTADO_LABEL[idea.estado]}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={editando !== null}
        onOpenChange={(a) => !a && setEditando(null)}
      >
        {editando && (
          <SheetContent title={editando.titulo}>
            <FormIdea
              idea={editando}
              imagenes={imagenes[editando.id] ?? []}
              onListo={() => setEditando(null)}
            />
          </SheetContent>
        )}
      </Sheet>
    </main>
  );
}

function FormIdea({
  idea,
  imagenes = [],
  onListo,
}: {
  idea?: Idea;
  imagenes?: Imagen[];
  onListo: () => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    const datos: DatosIdea = {
      titulo: String(f.get("titulo") ?? "").trim(),
      descripcion: (String(f.get("descripcion") ?? "").trim() || null) as
        | string
        | null,
      categoria: f.get("categoria") as Rubro,
      links: String(f.get("links") ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      estado: f.get("estado") as DatosIdea["estado"],
    };

    startTransition(async () => {
      const r = idea
        ? await actualizarIdea(idea.id, datos)
        : await crearIdea(datos);
      if (r.error) setError(r.error);
      else onListo();
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div>
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          autoFocus={!idea}
          defaultValue={idea?.titulo}
          placeholder="Ej: Centro de mesa con velas"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="categoria">Categoría</Label>
          <Select
            id="categoria"
            name="categoria"
            defaultValue={idea?.categoria ?? "decoracion"}
            className="mt-1"
          >
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {RUBRO_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Select
            id="estado"
            name="estado"
            defaultValue={idea?.estado ?? "idea"}
            className="mt-1"
          >
            {Object.entries(ESTADO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          defaultValue={idea?.descripcion ?? ""}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="links">Links (uno por línea)</Label>
        <Textarea
          id="links"
          name="links"
          defaultValue={idea?.links.join("\n") ?? ""}
          placeholder="https://instagram.com/p/..."
          className="mt-1 font-mono text-sm"
        />
      </div>

      {idea && idea.links.length > 0 && (
        <ul className="space-y-1 text-sm">
          {idea.links.map((l) => (
            <li key={l}>
              <a
                href={l}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 truncate text-primary underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {l}
              </a>
            </li>
          ))}
        </ul>
      )}

      {idea && <ImagenesIdea idea={idea} imagenes={imagenes} />}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando…" : idea ? "Guardar" : "Agregar idea"}
      </Button>

      {idea && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-danger"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Borrar "${idea.titulo}"?`)) return;
            startTransition(async () => {
              const r = await borrarIdea(idea.id);
              if (r.error) setError(r.error);
              else onListo();
            });
          }}
        >
          Borrar idea
        </Button>
      )}
    </form>
  );
}

function ImagenesIdea({ idea, imagenes }: { idea: Idea; imagenes: Imagen[] }) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Fotos</p>

      {imagenes.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {imagenes.map((img) => (
            <li key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="aspect-square w-full rounded-md object-cover"
              />
              <button
                type="button"
                aria-label="Borrar foto"
                disabled={pendiente}
                onClick={() =>
                  startTransition(async () => {
                    const r = await borrarImagenIdea(img.id, img.path);
                    if (r.error) setError(r.error);
                  })
                }
                className="absolute -right-1.5 -top-1.5 rounded-full bg-card p-1 shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="file"
        accept="image/*"
        disabled={pendiente}
        className="mt-2 block w-full text-sm"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          startTransition(async () => {
            const r = await subirImagenIdea(idea.id, archivo);
            if (r.error) setError(r.error);
          });
        }}
      />

      {pendiente && (
        <p className="mt-1 text-sm text-muted-foreground">Subiendo…</p>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
