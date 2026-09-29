import { supabaseAdmin } from "@/lib/finanzas/server/lib/supabase";
import { tareasIcs, type TareaCalendario } from "@/lib/calendario";

/*
 * Calendario de tareas de la boda (.ics). Es público a propósito: Google
 * Calendar lo pide sin sesión. Lo protege el token de la pareja, que solo
 * ven sus integrantes en /boda/tareas.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext<"/api/calendario/[token]">) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!UUID.test(token)) return new Response("No encontrado", { status: 404 });

  const { data: pareja, error } = await supabaseAdmin
    .from("couples")
    .select("id")
    .eq("calendar_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!pareja) return new Response("No encontrado", { status: 404 });

  const [tareasRes, miembrosRes] = await Promise.all([
    supabaseAdmin
      .from("wedding_tasks")
      .select("id, titulo, descripcion, fecha_limite, estado, responsable")
      .eq("couple_id", pareja.id)
      .not("fecha_limite", "is", null)
      .order("fecha_limite"),
    supabaseAdmin.from("couple_members").select("nombre, rol").eq("couple_id", pareja.id),
  ]);
  if (tareasRes.error) throw tareasRes.error;
  if (miembrosRes.error) throw miembrosRes.error;

  const miembros = miembrosRes.data ?? [];
  const nombreDe = (rol: string) =>
    rol === "ambos"
      ? "Los dos"
      : (miembros.find((m) => m.rol === rol)?.nombre ?? (rol === "novio" ? "Novio" : "Novia"));

  return new Response(tareasIcs((tareasRes.data ?? []) as TareaCalendario[], nombreDe), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tareas-boda.ics"',
      "Cache-Control": "no-store",
    },
  });
}
