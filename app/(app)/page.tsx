import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Card } from "@/components/ui/card";
import { formatFecha, formatMonto, hoyISO, diasHasta } from "@/lib/format";
import { agruparPorCategoria, sumar, CERO, type Item, type Pago } from "@/lib/plata";

export default async function DashboardPage() {
  const supabase = await createClient();
  const wedding = await getWedding();

  const [{ data: items }, { data: pagos }, { data: guests }, { data: tasks }] =
    await Promise.all([
      supabase
        .from("budget_items")
        .select(
          "id, categoria, concepto, monto_estimado, monto_real, moneda, vendor_id",
        ),
      supabase
        .from("payments")
        .select(
          "id, budget_item_id, monto, moneda, cotizacion_usd, fecha, medio_pago, tipo, comprobante_path, pagado",
        ),
      supabase.from("guests").select("rsvp, acompanantes"),
      supabase
        .from("tasks")
        .select("id, titulo, estado, fecha_limite")
        .neq("estado", "hecha")
        .order("fecha_limite", { nullsFirst: false }),
    ]);

  const hoy = hoyISO();
  const dias = diasHasta(wedding.fecha);
  const cot = wedding.cotizacion_referencia;

  const categorias = agruparPorCategoria(
    (items ?? []) as Item[],
    (pagos ?? []) as Pago[],
    cot,
  );
  const pagado = categorias.reduce((a, c) => sumar(a, c.pagado), CERO);
  const previsto = categorias.reduce((a, c) => sumar(a, c.previsto), CERO);
  const objetivoUSD =
    wedding.moneda_base === "USD"
      ? wedding.presupuesto_objetivo
      : wedding.presupuesto_objetivo / cot;

  const invitados = (guests ?? []).reduce((n, g) => n + 1 + g.acompanantes, 0);
  const confirmados = (guests ?? [])
    .filter((g) => g.rsvp === "confirmado")
    .reduce((n, g) => n + 1 + g.acompanantes, 0);
  const pendientesRsvp = (guests ?? []).filter(
    (g) => g.rsvp === "pendiente",
  ).length;

  const en7 = sumarDias(hoy, 7);
  const vencidas = (tasks ?? []).filter(
    (t) => t.fecha_limite && t.fecha_limite < hoy,
  );
  const estaSemana = (tasks ?? []).filter(
    (t) => t.fecha_limite && t.fecha_limite >= hoy && t.fecha_limite <= en7,
  );

  const en30 = sumarDias(hoy, 30);
  const proximosPagos = ((pagos ?? []) as Pago[])
    .filter((p) => !p.pagado && p.fecha <= en30)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const conceptoDe = (id: string) =>
    (items ?? []).find((i) => i.id === id)?.concepto ?? "Ítem borrado";

  return (
    <main>
      <h1 className="text-2xl font-semibold">Nuestro casamiento</h1>
      <p className="text-muted-foreground">
        {formatFecha(wedding.fecha)} · {wedding.lugar}
      </p>

      <Card className="mt-3 text-center">
        <p className="text-5xl font-semibold tabular-nums">{Math.abs(dias)}</p>
        <p className="text-muted-foreground">
          {dias > 0
            ? dias === 1
              ? "día para el casamiento"
              : "días para el casamiento"
            : dias === 0
              ? "¡Es hoy!"
              : "días desde el casamiento"}
        </p>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tarjeta
          href="/presupuesto"
          titulo="Presupuesto"
          valor={formatMonto(pagado.usd, "USD")}
          detalle={`pagado de ${formatMonto(objetivoUSD, "USD")}`}
          alerta={
            previsto.usd > objetivoUSD
              ? `Previsto ${formatMonto(previsto.usd, "USD")}`
              : undefined
          }
        />
        <Tarjeta
          href="/invitados"
          titulo="Invitados"
          valor={`${confirmados} de ${invitados}`}
          detalle={
            pendientesRsvp > 0
              ? `${pendientesRsvp} sin responder`
              : invitados === 0
                ? "cargá los primeros"
                : "todos respondieron"
          }
        />
        <Tarjeta
          href="/tareas"
          titulo="Tareas"
          valor={`${estaSemana.length}`}
          detalle="esta semana"
          alerta={
            vencidas.length > 0
              ? `${vencidas.length} vencida${vencidas.length > 1 ? "s" : ""}`
              : undefined
          }
        />
        <Tarjeta
          href="/pagos"
          titulo="Próximos pagos"
          valor={`${proximosPagos.length}`}
          detalle="en 30 días"
          alerta={
            proximosPagos.some((p) => p.fecha < hoy)
              ? "hay vencidos"
              : undefined
          }
        />
      </div>

      {vencidas.length > 0 && (
        <Seccion titulo="Tareas vencidas" href="/tareas">
          {vencidas.slice(0, 4).map((t) => (
            <li key={t.id} className="flex justify-between gap-2 px-3 py-2.5">
              <span className="truncate">{t.titulo}</span>
              <span className="shrink-0 text-sm text-danger">
                {formatFecha(t.fecha_limite)}
              </span>
            </li>
          ))}
        </Seccion>
      )}

      {estaSemana.length > 0 && (
        <Seccion titulo="Esta semana" href="/tareas">
          {estaSemana.slice(0, 4).map((t) => (
            <li key={t.id} className="flex justify-between gap-2 px-3 py-2.5">
              <span className="truncate">{t.titulo}</span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {formatFecha(t.fecha_limite)}
              </span>
            </li>
          ))}
        </Seccion>
      )}

      {proximosPagos.length > 0 && (
        <Seccion titulo="Próximos pagos" href="/pagos">
          {proximosPagos.slice(0, 4).map((p) => (
            <li key={p.id} className="flex justify-between gap-2 px-3 py-2.5">
              <span className="truncate">{conceptoDe(p.budget_item_id)}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatMonto(p.monto, p.moneda)} · {formatFecha(p.fecha)}
              </span>
            </li>
          ))}
        </Seccion>
      )}

      {invitados === 0 && items?.length === 0 && tasks?.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">Arranquemos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tres cosas para empezar: traer el checklist estándar desde Tareas,
            cargar los invitados (se pueden pegar de una planilla) y anotar el
            presupuesto del salón.
          </p>
        </div>
      )}
    </main>
  );
}

function sumarDias(iso: string, dias: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function Tarjeta({
  href,
  titulo,
  valor,
  detalle,
  alerta,
}: {
  href: string;
  titulo: string;
  valor: string;
  detalle: string;
  alerta?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-3 active:bg-muted"
    >
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
      {alerta && (
        <p className="mt-1 flex items-center gap-1 text-sm text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {alerta}
        </p>
      )}
    </Link>
  );
}

function Seccion({
  titulo,
  href,
  children,
}: {
  titulo: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <Link href={href} className="flex items-center justify-between">
        <h2 className="font-medium">{titulo}</h2>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
      <ul className="mt-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </ul>
    </section>
  );
}
