import { createClient } from "@/lib/supabase/server";
import { Sidebar, BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: pareja } = await supabase
    .from("couples")
    .select("nombre")
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh">
      <Sidebar nombres={pareja?.nombre ?? "Nosotros"} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5 lg:max-w-[1180px] lg:px-8 lg:pb-10 lg:pt-7">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
