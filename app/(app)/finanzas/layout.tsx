import { ModuloTabs } from "@/components/nav";
import { FinanzasShell } from "@/components/finanzas/shell";

export default function FinanzasLayout({ children }: LayoutProps<"/finanzas">) {
  return (
    <>
      <ModuloTabs modulo="/finanzas" />
      <FinanzasShell>{children}</FinanzasShell>
    </>
  );
}
