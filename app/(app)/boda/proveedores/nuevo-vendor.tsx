"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { FormVendor } from "./form-vendor";

export function NuevoVendor() {
  const [abierto, setAbierto] = useState(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Proveedor
        </Button>
      </SheetTrigger>
      <SheetContent title="Nuevo proveedor">
        <FormVendor onListo={() => setAbierto(false)} />
      </SheetContent>
    </Sheet>
  );
}
