import { redirect } from "next/navigation";
import { PresupuestoPage } from "@/components/finanzas/client-pages";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  // Presupuesto es de boda + viaje: un hogar solo-Finanzas no lo tiene.
  const supabase = await createClient();
  const { data: pareja } = await supabase.from("couples").select("solo_finanzas").limit(1).maybeSingle();
  if (pareja?.solo_finanzas) redirect("/finanzas");

  return <PresupuestoPage />;
}
