import { redirect } from "next/navigation";
import { ModuloTabs } from "@/components/nav";
import { ViajeShell } from "@/components/viaje/client-pages";
import { createClient } from "@/lib/supabase/server";

export default async function ViajeLayout({ children }: LayoutProps<"/viaje">) {
  const supabase = await createClient();
  const { data: pareja } = await supabase.from("couples").select("solo_finanzas").limit(1).maybeSingle();
  if (pareja?.solo_finanzas) redirect("/finanzas");

  return (
    <>
      <ModuloTabs modulo="/viaje" />
      <ViajeShell>{children}</ViajeShell>
    </>
  );
}
