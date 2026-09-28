import { createClient } from "@/lib/supabase/server";
import { Mesas } from "./mesas";

export default async function MesasPage() {
  const supabase = await createClient();

  const [{ data: tables }, { data: guests }] = await Promise.all([
    supabase
      .from("wedding_tables")
      .select("id, numero, capacidad, ubicacion")
      .order("numero"),
    supabase
      .from("wedding_guests")
      .select("id, nombre, grupo, acompanantes, rsvp, table_id")
      .order("nombre"),
  ]);

  return <Mesas mesas={tables ?? []} invitados={guests ?? []} />;
}
