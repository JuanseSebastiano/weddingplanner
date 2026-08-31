import { getWedding } from "@/lib/wedding";
import { formatFecha, diasHasta } from "@/lib/format";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const wedding = await getWedding();
  const dias = diasHasta(wedding.fecha);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Nuestro casamiento</h1>
      <p className="text-muted-foreground">
        {formatFecha(wedding.fecha)} · {wedding.lugar}
      </p>

      <Card className="mt-4 text-center">
        <p className="text-5xl font-semibold tabular-nums">{dias}</p>
        <p className="text-muted-foreground">
          {dias === 1 ? "día para el casamiento" : "días para el casamiento"}
        </p>
      </Card>
    </main>
  );
}
