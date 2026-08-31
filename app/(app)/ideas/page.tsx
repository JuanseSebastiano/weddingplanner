import { createClient } from "@/lib/supabase/server";
import { Ideas, type Idea } from "./ideas";

export default async function IdeasPage() {
  const supabase = await createClient();

  const [{ data: ideas }, { data: imagenes }] = await Promise.all([
    supabase
      .from("ideas")
      .select("id, titulo, descripcion, categoria, links, estado")
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, entidad_id, path")
      .eq("entidad", "idea"),
  ]);

  // El bucket es privado: cada imagen necesita una URL firmada para mostrarse.
  const paths = (imagenes ?? []).map((i) => i.path);
  const { data: firmadas } = paths.length
    ? await supabase.storage.from("files").createSignedUrls(paths, 60 * 60)
    : { data: [] };

  const urlPorPath = new Map(
    (firmadas ?? []).map((f) => [f.path, f.signedUrl]),
  );

  const imagenesPorIdea = new Map<
    string,
    { id: string; path: string; url: string }[]
  >();

  for (const img of imagenes ?? []) {
    const url = urlPorPath.get(img.path);
    if (!url || !img.entidad_id) continue;
    imagenesPorIdea.set(img.entidad_id, [
      ...(imagenesPorIdea.get(img.entidad_id) ?? []),
      { id: img.id, path: img.path, url },
    ]);
  }

  return (
    <Ideas
      ideas={(ideas ?? []) as Idea[]}
      imagenes={Object.fromEntries(imagenesPorIdea)}
    />
  );
}
