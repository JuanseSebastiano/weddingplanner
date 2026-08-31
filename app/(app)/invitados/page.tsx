import { createClient } from "@/lib/supabase/server";
import { ListaInvitados, type Invitado } from "./lista-invitados";

export default async function InvitadosPage() {
  const supabase = await createClient();

  const [{ data: guests }, { data: tables }] = await Promise.all([
    supabase
      .from("guests")
      .select(
        "id, nombre, grupo, lado, email, telefono, rsvp, acompanantes, menu, menu_detalle, alojamiento, notas, table_id",
      )
      .order("nombre"),
    supabase.from("tables").select("id, numero").order("numero"),
  ]);

  return (
    <ListaInvitados
      invitados={(guests ?? []) as Invitado[]}
      mesas={tables ?? []}
    />
  );
}
