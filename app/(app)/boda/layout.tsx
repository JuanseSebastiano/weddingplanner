import { redirect } from "next/navigation";
import { ModuloTabs } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function BodaLayout({ children }: LayoutProps<"/boda">) {
  const supabase = await createClient();
  const { data: pareja } = await supabase.from("couples").select("solo_finanzas").limit(1).maybeSingle();
  if (pareja?.solo_finanzas) redirect("/finanzas");

  return (
    <>
      <ModuloTabs modulo="/boda" />
      {children}
    </>
  );
}
