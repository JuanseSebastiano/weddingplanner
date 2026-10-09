import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Heart,
  Plane,
  Wallet,
} from "lucide-react";
import { formatMonthLabel } from "@nf/shared";
import { createClient } from "@/lib/supabase/server";
import { getCommitmentsSummary } from "@/lib/finanzas/server/services/commitments";
import { getDashboardSummary } from "@/lib/finanzas/server/services/dashboard";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diasHasta, formatFecha, formatMonto, hoyISO } from "@/lib/format";
import { agruparPorCategoria, CERO, sumar, type Item, type Pago } from "@/lib/plata";
import { salir } from "./actions";

const ORIGEN: Record<string, string> = {
  boda: "Boda",
  viaje: "Viaje",
  tarjeta: "Tarjeta",
};

/** Color de cada integrante en el reparto del mes (mismo orden que Finanzas). */
const COLOR_PERSONA = ["bg-data", "bg-sage"];

function sumarDias(iso: string, dias: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function porcentaje(parte: number, total: number) {
  return total > 0 ? Math.min(100, Math.max(0, (parte / total) * 100)) : 0;
}

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: miembro },
    { data: boda },
    { data: items },
    { data: pagos },
    { data: invitados },
    { data: tareas },
    { data: viaje },
    { data: paradas },
  ] = await Promise.all([
    supabase
      .from("couple_members")
      .select("couple_id, nombre")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("wedding_info")
      .select("fecha, lugar, cotizacion_referencia")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("wedding_budget_items")
      .select("id, categoria, concepto, monto_estimado, monto_real, moneda, vendor_id"),
    supabase
      .from("wedding_payments")
      .select(
        "id, budget_item_id, monto, moneda, cotizacion_usd, fecha, medio_pago, tipo, comprobante_path, pagado",
      ),
    supabase.from("wedding_guests").select("rsvp, acompanantes"),
    supabase.from("wedding_tasks").select("id, titulo, estado, fecha_limite").order("fecha_limite"),
    supabase
      .from("trip_trips")
      .select("nombre, inicio, fin")
      .is("deleted_at", null)
      .order("inicio")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trip_stops")
      .select("ciudad, desde")
      .is("deleted_at", null)
      .order("desde"),
  ]);

  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const coupleId = miembro?.couple_id;

  // Finanzas se lee con el service role, igual que /api/fin, siempre
  // filtrado por la pareja del usuario.
  const [finanzas, plata] = coupleId
    ? await Promise.all([
        getDashboardSummary(coupleId, mes).catch(() => null),
        getCommitmentsSummary(coupleId).catch(() => null),
      ])
    : [null, null];

  /* ---- boda ---- */
  const cot = Number(boda?.cotizacion_referencia ?? 0);
  const categorias =
    cot > 0 ? agruparPorCategoria((items ?? []) as Item[], (pagos ?? []) as Pago[], cot) : [];
  const bodaPagado = categorias.reduce((a, c) => sumar(a, c.pagado), CERO);
  const bodaPrevisto = categorias.reduce((a, c) => sumar(a, c.previsto), CERO);
  const g = invitados ?? [];
  const personas = g.reduce((n, x) => n + 1 + x.acompanantes, 0);
  const confirmados = g
    .filter((x) => x.rsvp === "confirmado")
    .reduce((n, x) => n + 1 + x.acompanantes, 0);
  const t = tareas ?? [];
  const hechas = t.filter((x) => x.estado === "hecha").length;
  const abiertas = t.filter((x) => x.estado !== "hecha" && x.fecha_limite);
  const en7 = sumarDias(hoy, 7);
  const vencidas = abiertas.filter((x) => x.fecha_limite! < hoy);
  const estaSemana = abiertas.filter((x) => x.fecha_limite! >= hoy && x.fecha_limite! <= en7);

  /* ---- viaje ---- */
  const p = paradas ?? [];
  const inicioViaje = viaje?.inicio ?? p.find((x) => x.desde)?.desde ?? null;
  const ciudades = [...new Set(p.map((x) => x.ciudad).filter(Boolean))];
  const presupuestoViaje = plata?.trip_budget ?? [];
  const proximaViaje =
    plata?.commitments.find((c) => c.source === "viaje" && c.due_date && c.due_date >= hoy) ??
    null;

  /* ---- lo que viene ---- */
  const proximos = (plata?.commitments ?? []).filter((c) => c.due_date).slice(0, 5);

  return (
    <main className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">
          {new Date(hoy + "T12:00:00").toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="font-serif text-3xl font-normal lg:text-4xl">
          Hola{miembro?.nombre ? `, ${miembro.nombre}` : ""}
        </h1>
      </div>

      {/* ---------- FINANZAS DEL MES ---------- */}
      <ResumenFinanzas finanzas={finanzas} mes={mes} hoy={hoy} />

      {/* ---------- CASAMIENTO Y LUNA DE MIEL ---------- */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Proyecto
          href="/boda"
          icono={<Heart className="h-4 w-4" />}
          titulo="Casamiento"
          fecha={boda?.fecha ?? null}
          detalle={boda?.lugar}
          vacio="Sin fecha cargada"
        >
          <Progreso
            label="Presupuesto pagado"
            valor={formatMonto(bodaPagado.usd, "USD")}
            total={bodaPrevisto.usd > 0 ? `de ${formatMonto(bodaPrevisto.usd, "USD")}` : "sin presupuesto"}
            pct={porcentaje(bodaPagado.usd, bodaPrevisto.usd)}
            color="bg-data"
          />
          <Progreso
            label="Invitados confirmados"
            valor={`${confirmados}`}
            total={`de ${personas}`}
            pct={porcentaje(confirmados, personas)}
            color="bg-success"
          />
          <Progreso
            label="Tareas hechas"
            valor={`${hechas}`}
            total={`de ${t.length}`}
            pct={porcentaje(hechas, t.length)}
            color="bg-sage"
            aviso={
              vencidas.length > 0
                ? `${vencidas.length} ${vencidas.length === 1 ? "vencida" : "vencidas"}`
                : undefined
            }
          />
        </Proyecto>

        <Proyecto
          href="/viaje"
          icono={<Plane className="h-4 w-4" />}
          titulo={viaje?.nombre || "Luna de miel"}
          fecha={inicioViaje}
          detalle={
            ciudades.length > 0
              ? `${ciudades.length} ${ciudades.length === 1 ? "ciudad" : "ciudades"}: ${ciudades.slice(0, 4).join(", ")}${ciudades.length > 4 ? "…" : ""}`
              : undefined
          }
          vacio="Todavía sin itinerario"
        >
          {presupuestoViaje.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay nada con precio.</p>
          ) : (
            presupuestoViaje.map((b) => (
              <Progreso
                key={b.currency}
                label={`Presupuesto pagado${presupuestoViaje.length > 1 ? ` (${b.currency})` : ""}`}
                valor={formatMonto(b.paid, b.currency)}
                total={`de ${formatMonto(b.total, b.currency)}`}
                pct={porcentaje(b.paid, b.total)}
                color="bg-data"
              />
            ))
          )}
          {proximaViaje && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.09em] text-subtle">
                  Próximo pago
                </span>
                <span className="block truncate">{proximaViaje.label}</span>
                <span className="text-xs text-muted-foreground">{formatFecha(proximaViaje.due_date)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMonto(proximaViaje.amount, proximaViaje.currency)}
              </span>
            </div>
          )}
        </Proyecto>
      </section>

      {plata?.alert && (
        <Link
          href={plata.alert.commitment.href}
          className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No alcanza para el próximo pago de la boda:</strong>{" "}
            {plata.alert.commitment.label} ({formatFecha(plata.alert.commitment.due_date)}) necesita{" "}
            {formatMonto(plata.alert.needed_ars, "ARS")} y el disponible proyectado es{" "}
            {formatMonto(plata.alert.projected_ars, "ARS")}.
          </span>
        </Link>
      )}

      {/* ---------- LO QUE VIENE ---------- */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>Próximos vencimientos</CardTitle>
            {plata && (
              <Link href="/finanzas" className="text-xs text-muted-foreground">
                Disponible real{" "}
                <span
                  className={`font-semibold tabular-nums ${plata.available_ars < 0 ? "text-danger" : "text-foreground"}`}
                >
                  {formatMonto(plata.available_ars, "ARS")}
                </span>
              </Link>
            )}
          </div>
          {proximos.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nada pendiente.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border-soft">
              {proximos.map((c) => (
                <li key={`${c.source}-${c.ref_id}-${c.currency}-${c.due_date}`}>
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
          <CardTitle>Tareas de la semana</CardTitle>
          <ListaTareas titulo="Vencidas" tareas={vencidas} alerta />
          <ListaTareas titulo="Esta semana" tareas={estaSemana} />
          {vencidas.length === 0 && estaSemana.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Nada para esta semana.</p>
          )}
        </Card>
      </section>

      <form action={salir} className="lg:hidden">
        <Button variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </main>
  );
}

/** Lo principal del dashboard de Finanzas para el mes en curso. */
function ResumenFinanzas({
  finanzas,
  mes,
  hoy,
}: {
  finanzas: Awaited<ReturnType<typeof getDashboardSummary>> | null;
  mes: string;
  hoy: string;
}) {
  if (!finanzas) {
    return (
      <Link href="/finanzas">
        <Card className="flex items-center justify-between gap-3">
          <div>
            <Eyebrow>Finanzas</Eyebrow>
            <p className="mt-1 text-sm text-muted-foreground">No pudimos cargar el resumen del mes.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Card>
      </Link>
    );
  }

  const nombreMes = formatMonthLabel(mes).split(" ")[0]?.toLowerCase() ?? "";
  const variacion =
    finanzas.previous_month_total > 0
      ? (finanzas.month_total - finanzas.previous_month_total) / finanzas.previous_month_total
      : null;
  const dias = Number(hoy.slice(8, 10));
  const rubros = finanzas.by_category.slice(0, 4);
  const maxRubro = Math.max(1, ...rubros.map((r) => r.total));
  const totalReparto = finanzas.by_user.reduce((n, u) => n + u.total, 0);
  const orden = finanzas.members.map((m) => m.id);
  const reparto = [...finanzas.by_user].sort(
    (a, b) => orden.indexOf(a.user_id) - orden.indexOf(b.user_id),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Link
        href="/finanzas"
        className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-primary" />
          Finanzas · {formatMonthLabel(mes)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {finanzas.pending_count > 0 && (
            <Badge className="bg-warning-soft text-warning">
              {finanzas.pending_count} por revisar
            </Badge>
          )}
          Ver todo
          <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-6">
        {/* Total y datos del mes */}
        <div className="flex flex-col gap-5">
          <div>
            <Eyebrow>Gastado en {nombreMes}</Eyebrow>
            <p className="mt-1 font-serif text-5xl leading-none tabular-nums">
              {formatMonto(finanzas.month_total, "ARS")}
            </p>
            {variacion !== null && (
              <p
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  variacion > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
                }`}
              >
                {variacion > 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(Math.round(variacion * 100))}% vs. mes anterior (
                {formatMonto(finanzas.previous_month_total, "ARS")})
              </p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <Dato label="Ingresos" valor={formatMonto(finanzas.income_total, "ARS")} />
            <Dato
              label="Balance"
              valor={formatMonto(finanzas.net, "ARS")}
              tono={finanzas.net < 0 ? "text-danger" : "text-success"}
            />
            <Dato
              label="Por día"
              valor={formatMonto(dias > 0 ? finanzas.month_total / dias : 0, "ARS")}
            />
          </dl>

          {reparto.length > 1 && totalReparto > 0 && (
            <div>
              <Eyebrow>Entre nosotros</Eyebrow>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {reparto.map((u, i) => (
                  <div
                    key={u.user_id}
                    className={COLOR_PERSONA[i % COLOR_PERSONA.length]}
                    style={{ width: `${porcentaje(u.total, totalReparto)}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
                {reparto.map((u, i) => (
                  <span key={u.user_id} className="flex items-center gap-1.5">
                    <i
                      className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR_PERSONA[i % COLOR_PERSONA.length]}`}
                    />
                    {u.display_name}
                    <span className="tabular-nums text-muted-foreground">
                      {formatMonto(u.total, "ARS")}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rubros */}
        <div>
          <Eyebrow>En qué se fue</Eyebrow>
          {rubros.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Todavía no hay gastos este mes.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {rubros.map((r) => (
                <li key={r.category_id ?? "sin-rubro"}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{r.category_name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatMonto(r.total, "ARS")}
                      <span className="ml-1.5 text-xs text-subtle">
                        {Math.round(porcentaje(r.total, finanzas.month_total))}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${porcentaje(r.total, maxRubro)}%`, backgroundColor: r.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {finanzas.by_category.length > rubros.length && (
            <p className="mt-3 text-xs text-subtle">
              y {finanzas.by_category.length - rubros.length}{" "}
              {finanzas.by_category.length - rubros.length === 1 ? "rubro más" : "rubros más"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Dato({ label, valor, tono }: { label: string; valor: string; tono?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.09em] text-subtle">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tono ?? ""}`}>{valor}</dd>
    </div>
  );
}

function Proyecto({
  href,
  icono,
  titulo,
  fecha,
  detalle,
  vacio,
  children,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  fecha: string | null;
  detalle?: string;
  vacio: string;
  children: React.ReactNode;
}) {
  const dias = fecha ? diasHasta(fecha) : null;
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <Link href={href} className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            {icono}
            {titulo}
          </span>
          {dias === null ? (
            <p className="mt-1 text-sm text-muted-foreground">{vacio}</p>
          ) : (
            <>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-serif text-4xl leading-none tabular-nums">{Math.abs(dias)}</span>
                <span className="text-sm text-muted-foreground">
                  {dias > 0 ? (dias === 1 ? "día" : "días") : dias === 0 ? "¡es hoy!" : "días desde"}
                </span>
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {formatFecha(fecha)}
                {detalle ? ` · ${detalle}` : ""}
              </p>
            </>
          )}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
      <div className="flex flex-col gap-3.5">{children}</div>
    </Card>
  );
}

function Progreso({
  label,
  valor,
  total,
  pct,
  color,
  aviso,
}: {
  label: string;
  valor: string;
  total: string;
  pct: number;
  color: string;
  aviso?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-semibold">{valor}</span>{" "}
          <span className="text-xs text-subtle">{total}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {aviso && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {aviso}
        </p>
      )}
    </div>
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
        {tareas.slice(0, 6).map((t) => (
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
      {tareas.length > 6 && <p className="mt-1 text-xs text-subtle">y {tareas.length - 6} más</p>}
    </div>
  );
}
