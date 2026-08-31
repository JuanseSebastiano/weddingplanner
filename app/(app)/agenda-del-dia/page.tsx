import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Agenda } from "./agenda";

export default async function AgendaPage() {
  const supabase = await createClient();
  const wedding = await getWedding();

  const { data: eventos } = await supabase
    .from("timeline_events")
    .select("id, hora, actividad, responsable, notas")
    .order("hora");

  return (
    <Agenda
      eventos={eventos ?? []}
      fecha={wedding.fecha}
      lugar={wedding.lugar}
    />
  );
}
