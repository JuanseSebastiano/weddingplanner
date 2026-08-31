import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Tareas, type Tarea } from "./tareas";

export default async function TareasPage() {
  const supabase = await createClient();
  const wedding = await getWedding();

  const [{ data: tasks }, { data: vendors }, { data: miembros }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, titulo, descripcion, categoria, responsable, fecha_limite, prioridad, estado, depende_de, vendor_id",
        )
        .order("fecha_limite", { nullsFirst: false }),
      supabase.from("vendors").select("id, nombre").order("nombre"),
      supabase.from("wedding_members").select("nombre, rol"),
    ]);

  return (
    <Tareas
      tareas={(tasks ?? []) as Tarea[]}
      vendors={vendors ?? []}
      miembros={miembros ?? []}
      fechaBoda={wedding.fecha}
    />
  );
}
