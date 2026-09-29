import { ModuloTabs } from "@/components/nav";
import { ViajeShell } from "@/components/viaje/client-pages";

export default function ViajeLayout({ children }: LayoutProps<"/viaje">) {
  return (
    <>
      <ModuloTabs modulo="/viaje" />
      <ViajeShell>{children}</ViajeShell>
    </>
  );
}
