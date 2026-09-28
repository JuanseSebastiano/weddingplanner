import { BodaTabs } from "@/components/nav";

export default function BodaLayout({ children }: LayoutProps<"/boda">) {
  return (
    <>
      <BodaTabs />
      {children}
    </>
  );
}
