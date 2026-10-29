import { ModuloTabs } from "@/components/nav";
import { FinanzasShell } from "@/components/finanzas/shell";
import { createClient } from "@/lib/supabase/server";

export default async function FinanzasLayout({ children }: LayoutProps<"/finanzas">) {
  const supabase = await createClient();
  const { data: pareja } = await supabase.from("couples").select("solo_finanzas").limit(1).maybeSingle();

  return (
    <>
      <ModuloTabs modulo="/finanzas" soloFinanzas={pareja?.solo_finanzas} />
      <FinanzasShell>{children}</FinanzasShell>
    </>
  );
}
