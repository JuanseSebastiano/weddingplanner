import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Sidebar, BottomNav } from "@/components/nav";
import { formatFecha } from "@/lib/format";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();

  const [wedding, { data: miembros }, { data: auth }] = await Promise.all([
    getWedding(),
    supabase.from("wedding_members").select("nombre, rol").order("rol"),
    supabase.auth.getUser(),
  ]);

  const novia = miembros?.find((m) => m.rol === "novia")?.nombre;
  const novio = miembros?.find((m) => m.rol === "novio")?.nombre;
  const nombres = [novia, novio].filter(Boolean).join(" & ") || "Casamiento";

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        nombres={nombres}
        fecha={formatFecha(wedding.fecha)}
        email={auth.user?.email ?? ""}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5 lg:max-w-[1180px] lg:px-8 lg:pb-10 lg:pt-7">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
