import { ModuloTabs } from "@/components/nav";

export default function BodaLayout({ children }: LayoutProps<"/boda">) {
  return (
    <>
      <ModuloTabs modulo="/boda" />
      {children}
    </>
  );
}
