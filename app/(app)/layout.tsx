import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
      {children}
      <BottomNav />
    </div>
  );
}
