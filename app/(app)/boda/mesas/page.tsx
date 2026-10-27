import { createClient } from "@/lib/supabase/server";
import { Mesas } from "./mesas";

export default async function MesasPage() {
  const supabase = await createClient();

  const [{ data: tables }, { data: guests }, { data: elementos }] = await Promise.all([
    supabase
      .from("wedding_tables")
      .select("id, numero, capacidad, ubicacion, forma, x, y, ancho, largo")
      .order("numero"),
    supabase
      .from("wedding_guests")
      .select("id, nombre, grupo, acompanantes, rsvp, table_id")
      .order("nombre"),
    supabase.from("wedding_layout_items").select("id, tipo, nombre, x, y, ancho, largo"),
  ]);

  // numeric de Postgres llega como string.
  const num = (v: unknown) => (v === null ? null : Number(v));
  const mesas = (tables ?? []).map((t) => ({
    ...t,
    x: num(t.x),
    y: num(t.y),
    ancho: Number(t.ancho),
    largo: Number(t.largo),
  }));
  const items = (elementos ?? []).map((e) => ({
    ...e,
    x: Number(e.x),
    y: Number(e.y),
    ancho: Number(e.ancho),
    largo: Number(e.largo),
  }));

  return <Mesas mesas={mesas} invitados={guests ?? []} elementos={items} />;
}
