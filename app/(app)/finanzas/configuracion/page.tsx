import { SettingsPage } from "@/components/finanzas/client-pages";
import { Button } from "@/components/ui/button";
import { salir } from "@/app/(app)/actions";

export default function Page() {
  return (
    <>
      <SettingsPage />
      {/* En celular, los hogares solo-Finanzas no tienen Inicio: cerrar sesión va acá. */}
      <form action={salir} className="mt-6 lg:hidden">
        <Button variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
}
