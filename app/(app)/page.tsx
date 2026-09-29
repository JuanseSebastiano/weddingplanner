import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCommitmentsSummary } from "@/lib/finanzas/server/services/commitments";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diasHasta, formatFecha, formatMonto, hoyISO } from "@/lib/format";
import { salir } from "./actions";

const ORIGEN: Record<string, string> = {
  boda: "Boda",
  viaje: "Viaje",
  tarjeta: "Tarjeta",
};

function sumarDias(iso: string, dias: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: miembro }, { data: boda }, { data: viaje }, { data: primeraParada }, { data: tareas }] =
    await Promise.all([
      supabase.from("couple_members").select("couple_id").eq("user_id", user!.id).maybeSingle(),
      supabase.from("wedding_info").select("fecha, lugar").limit(1).maybeSingle(),
      supabase
        .from("trip_trips")
        .select("nombre, inicio")
        .is("deleted_at", null)
        .order("inicio")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("trip_stops")
        .select("desde")
        .is("deleted_at", null)
        .not("desde", "is", null)
        .order("desde")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("wedding_tasks")
        .select("id, titulo, fecha_limite")
        .neq("estado", "hecha")
        .not("fecha_limite", "is", null)
        .order("fecha_limite"),
    ]);

  const plata = miembro ? await getCommitmentsSummary(miembro.couple_id) : null;

  const hoy = hoyISO();
  const en7 = sumarDias(hoy, 7);
  const vencidas = (tareas ?? []).filter((t) => t.fecha_limite! < hoy);
  const estaSemana = (tareas ?? []).filter(
    (t) => t.fecha_limite! >= hoy && t.fecha_limite! <= en7,
  );
  const inicioViaje = viaje?.inicio ?? primeraParada?.desde ?? null;
  const proximos = (plata?.commitments ?? []).filter((c) => c.due_date).slice(0, 5);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-normal lg:text-[28px]">Inicio</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <Cuenta
          href="/boda"
          titulo="Casamiento"
          fecha={boda?.fecha ?? null}
          detalle={boda?.lugar}
          vacio="Sin fecha cargada"
        />
        <Cuenta
          href="/viaje"
          titulo={viaje?.nombre ?? "Viaje"}
          fecha={inicioViaje}
          vacio="Todavía sin itinerario"
        />
      </div>

      <Link href="/finanzas">
        <Card className="flex items-center justify-between gap-3">
          <div>
            <Eyebrow>Disponible real conjunto</Eyebrow>
            <p
              className={`mt-1 font-serif text-3xl tabular-nums ${
                (plata?.available_ars ?? 0) < 0 ? "text-danger" : ""
              }`}
            >
              {formatMonto(plata?.available_ars ?? 0, "ARS")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo líquido menos lo que falta pagar de las tarjetas
              {plata?.reference_rate ? ` · dólares a $ ${plata.reference_rate}` : ""}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Card>
      </Link>

      {plata?.alert && (
        <Link
          href={plata.alert.commitment.href}
          className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          <strong>No alcanza para el próximo pago de la boda:</strong>{" "}
          {plata.alert.commitment.label} ({formatFecha(plata.alert.commitment.due_date)}) necesita{" "}
          {formatMonto(plata.alert.needed_ars, "ARS")} y el disponible proyectado es{" "}
          {formatMonto(plata.alert.projected_ars, "ARS")}.
        </Link>
      )}

      <Card>
        <CardTitle>Próximos vencimientos</CardTitle>
        {proximos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nada pendiente.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border-soft">
            {proximos.map((c) => (
              <li key={`${c.source}-${c.ref_id}-${c.currency}`}>
                <Link href={c.href} className="flex items-center gap-3 py-2.5">
                  <Badge>{ORIGEN[c.source]}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.label}</span>
                    <span
                      className={`text-xs ${c.due_date! < hoy ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {formatFecha(c.due_date)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatMonto(c.amount, c.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Tareas</CardTitle>
        <ListaTareas titulo="Vencidas" tareas={vencidas} alerta />
        <ListaTareas titulo="Esta semana" tareas={estaSemana} />
        {vencidas.length === 0 && estaSemana.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">Nada para esta semana.</p>
        )}
      </Card>

      <form action={salir} className="lg:hidden">
        <Button variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}

function Cuenta({
  href,
  titulo,
  fecha,
  detalle,
  vacio,
}: {
  href: string;
  titulo: string;
  fecha: string | null;
  detalle?: string;
  vacio: string;
}) {
  const dias = fecha ? diasHasta(fecha) : null;
  return (
    <Link href={href}>
      <Card className="h-full">
        <Eyebrow>{titulo}</Eyebrow>
        {dias === null ? (
          <p className="mt-1 text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-4xl leading-none tabular-nums">
                {Math.abs(dias)}
              </span>
              <span className="text-sm text-muted-foreground">
                {dias > 0 ? (dias === 1 ? "día" : "días") : dias === 0 ? "¡es hoy!" : "días desde"}
              </span>
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {formatFecha(fecha)}
              {detalle ? ` · ${detalle}` : ""}
            </p>
          </>
        )}
      </Card>
    </Link>
  );
}

function ListaTareas({
  titulo,
  tareas,
  alerta = false,
}: {
  titulo: string;
  tareas: { id: string; titulo: string; fecha_limite: string | null }[];
  alerta?: boolean;
}) {
  if (tareas.length === 0) return null;
  return (
    <div className="mt-3">
      <Eyebrow className={alerta ? "text-danger" : undefined}>
        {titulo} · {tareas.length}
      </Eyebrow>
      <ul className="mt-1 divide-y divide-border-soft">
        {tareas.map((t) => (
          <li key={t.id}>
            <Link href="/boda/tareas" className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">{t.titulo}</span>
              <span className={`shrink-0 text-xs ${alerta ? "text-danger" : "text-muted-foreground"}`}>
                {formatFecha(t.fecha_limite)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
