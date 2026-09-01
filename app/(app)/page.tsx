import Link from "next/link";
import { AlertTriangle, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWedding } from "@/lib/wedding";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatFecha,
  formatMonto,
  hoyISO,
  diasHasta,
  RUBRO_LABEL,
} from "@/lib/format";
import {
  agruparPorCategoria,
  sumar,
  CERO,
  type Item,
  type Pago,
} from "@/lib/plata";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Todo en paralelo: la base está en San Pablo y cada viaje se nota en el celular.
  const [
    wedding,
    { data: items },
    { data: pagos },
    { data: guests },
    { data: tables },
    { data: tasks },
    { data: vendors },
    { data: ideas },
    { count: actividades },
  ] = await Promise.all([
    getWedding(),
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
    supabase.from("guests").select("rsvp, acompanantes, menu, table_id"),
    supabase.from("tables").select("id, capacidad"),
    supabase.from("tasks").select("id, titulo, estado, fecha_limite"),
    supabase.from("vendors").select("estado"),
    supabase.from("ideas").select("estado"),
    supabase
      .from("timeline_events")
      .select("id", { count: "exact", head: true }),
  ]);

  const hoy = hoyISO();
  const dias = diasHasta(wedding.fecha);
  const cot = wedding.cotizacion_referencia;

  /* ---- plata ---- */
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
  const usado = objetivoUSD > 0 ? pagado.usd / objetivoUSD : 0;
  const maxCategoria = Math.max(1, ...categorias.map((c) => c.previsto.usd));

  /* ---- invitados y mesas ---- */
  const g = guests ?? [];
  const personas = g.reduce((n, x) => n + 1 + x.acompanantes, 0);
  const confirmados = g
    .filter((x) => x.rsvp === "confirmado")
    .reduce((n, x) => n + 1 + x.acompanantes, 0);
  const pendientes = g.filter((x) => x.rsvp === "pendiente").length;
  const rechazados = g.filter((x) => x.rsvp === "rechazado").length;
  const menusEspeciales = g.filter((x) => x.menu !== "ninguno").length;
  const sinMesa = g.filter((x) => !x.table_id).length;
  const lugares = (tables ?? []).reduce((n, t) => n + t.capacidad, 0);
  const ocupados = g
    .filter((x) => x.table_id)
    .reduce((n, x) => n + 1 + x.acompanantes, 0);

  /* ---- tareas ---- */
  const t = tasks ?? [];
  const hechas = t.filter((x) => x.estado === "hecha").length;
  const abiertas = t.filter((x) => x.estado !== "hecha");
  const vencidas = abiertas.filter(
    (x) => x.fecha_limite && x.fecha_limite < hoy,
  );
  const en7 = sumarDias(hoy, 7);
  const estaSemana = abiertas.filter(
    (x) => x.fecha_limite && x.fecha_limite >= hoy && x.fecha_limite <= en7,
  );

  /* ---- pagos ---- */
  const en30 = sumarDias(hoy, 30);
  const proximos = ((pagos ?? []) as Pago[])
    .filter((p) => !p.pagado && p.fecha <= en30)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const totalProximos = proximos.reduce(
    (n, p) =>
      n + (p.moneda === "USD" ? p.monto : p.monto / (p.cotizacion_usd ?? cot)),
    0,
  );
  const conceptoDe = (id: string) =>
    (items ?? []).find((i) => i.id === id)?.concepto ?? "Ítem borrado";

  /* ---- proveedores e ideas ---- */
  const v = vendors ?? [];
  const contratados = v.filter((x) => x.estado === "contratado").length;
  const conPresupuesto = v.filter(
    (x) => x.estado === "presupuesto_recibido",
  ).length;
  const contactados = v.filter((x) => x.estado === "contactado").length;
  const ideasAprobadas = (ideas ?? []).filter(
    (x) => x.estado === "aprobada",
  ).length;
  const ideasEvaluando = (ideas ?? []).filter(
    (x) => x.estado === "evaluando",
  ).length;

  const vacio = g.length === 0 && (items ?? []).length === 0 && t.length === 0;

  return (
    <main className="flex flex-col gap-5">
      {/* ---------- HERO ---------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:flex">
        <div className="flex-1 bg-gradient-to-b from-card to-[#fdf8f3] p-5 lg:p-7">
          <Eyebrow>Faltan</Eyebrow>
          <p className="mt-0.5 flex items-baseline gap-2.5">
            <span className="font-serif text-5xl leading-none tabular-nums lg:text-6xl">
              {Math.abs(dias)}
            </span>
            <span className="text-base text-muted-foreground lg:text-lg">
              {dias > 0
                ? dias === 1
                  ? "día para el casamiento"
                  : "días para el casamiento"
                : dias === 0
                  ? "¡es hoy!"
                  : "días desde el casamiento"}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatFecha(wedding.fecha)} · {wedding.lugar}
          </p>

          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
            <DatoHero
              label="Confirmados"
              valor={`${confirmados}`}
              detalle={`de ${personas}`}
            />
            <DatoHero
              label="Pagado"
              valor={formatMonto(pagado.usd, "USD")}
              detalle={`de ${formatMonto(objetivoUSD, "USD")}`}
            />
            <DatoHero
              label="Tareas hechas"
              valor={`${hechas}`}
              detalle={`de ${t.length}`}
            />
          </dl>
        </div>

        {/*
          La foto va de fondo y no como <img>: si todavía no subieron
          public/portada.jpg se ve el degradé en vez de un ícono roto.
        */}
        <div
          className="hidden h-40 bg-[linear-gradient(120deg,#C9CBB6_0%,#D9D2C2_55%,#E4DACB_100%)] bg-cover bg-center sm:block lg:h-auto lg:w-[38%] lg:shrink-0"
          style={{ backgroundImage: "url(/portada.jpg)" }}
          role="presentation"
        />
      </section>

      {vacio && (
        <Card className="border-dashed text-center">
          <p className="font-medium">Arranquemos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Tres cosas para empezar: traer el checklist estándar desde Tareas,
            cargar los invitados (se pueden pegar de una planilla) y anotar el
            presupuesto del salón.
          </p>
        </Card>
      )}

      {/* ---------- TARJETAS ---------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Tarjeta href="/presupuesto" titulo="Presupuesto">
          <p className="text-xl font-semibold tabular-nums lg:text-2xl">
            {formatMonto(pagado.usd, "USD")}
          </p>
          <p className="text-xs tabular-nums text-subtle">
            {formatMonto(pagado.ars, "ARS")} · {Math.round(usado * 100)}% del
            objetivo
          </p>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-data"
              style={{ width: `${Math.min(100, usado * 100)}%` }}
            />
            <div
              className="bg-data-soft"
              style={{
                width: `${Math.min(
                  100 - Math.min(100, usado * 100),
                  objetivoUSD > 0
                    ? Math.max(0, (previsto.usd - pagado.usd) / objetivoUSD) *
                        100
                    : 0,
                )}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-subtle">
            Falta {formatMonto(Math.max(0, previsto.usd - pagado.usd), "USD")}
          </p>
        </Tarjeta>

        <Tarjeta href="/invitados" titulo="Invitados">
          <p className="text-xl font-semibold tabular-nums lg:text-2xl">
            {confirmados}{" "}
            <span className="text-sm font-medium text-subtle">
              de {personas}
            </span>
          </p>
          <p className="text-xs text-subtle">
            {pendientes > 0
              ? `${pendientes} sin responder`
              : g.length === 0
                ? "cargá los primeros"
                : "todos respondieron"}
          </p>
          <div className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <Segmento valor={confirmados} total={personas} clase="bg-success" />
            <Segmento valor={pendientes} total={personas} clase="bg-muted" />
            <Segmento
              valor={rechazados}
              total={personas}
              clase="bg-danger-soft"
            />
          </div>
          {menusEspeciales > 0 && (
            <p className="mt-1.5 text-[11px] text-subtle">
              {menusEspeciales} con menú especial
            </p>
          )}
        </Tarjeta>

        <Tarjeta href="/tareas" titulo="Tareas">
          <p className="text-xl font-semibold tabular-nums lg:text-2xl">
            {hechas}{" "}
            <span className="text-sm font-medium text-subtle">
              de {t.length}
            </span>
          </p>
          <p className="text-xs text-subtle">
            {estaSemana.length} vencen esta semana
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-sage"
              style={{
                width: `${t.length > 0 ? (hechas / t.length) * 100 : 0}%`,
              }}
            />
          </div>
          {vencidas.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-danger">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {vencidas.length} {vencidas.length === 1 ? "vencida" : "vencidas"}
            </p>
          )}
        </Tarjeta>

        <Tarjeta href="/mesas" titulo="Mesas">
          <p className="text-xl font-semibold tabular-nums lg:text-2xl">
            {(tables ?? []).length}{" "}
            <span className="text-sm font-medium text-subtle">mesas</span>
          </p>
          <p className="text-xs tabular-nums text-subtle">
            {ocupados} de {lugares} lugares
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-sage"
              style={{
                width: `${lugares > 0 ? Math.min(100, (ocupados / lugares) * 100) : 0}%`,
              }}
            />
          </div>
          {sinMesa > 0 && (
            <p className="mt-1.5 text-[11px] font-semibold text-warning">
              {sinMesa} sin mesa
            </p>
          )}
        </Tarjeta>
      </section>

      {/* ---------- GRILLA PRINCIPAL ---------- */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          {categorias.length > 0 && (
            <Card>
              <div className="mb-4 flex items-baseline gap-2.5">
                <CardTitle>Presupuesto por categoría</CardTitle>
                <span className="hidden text-xs text-subtle sm:inline">
                  previsto vs pagado, en dólares
                </span>
                <Link
                  href="/presupuesto"
                  className="ml-auto text-xs font-semibold text-primary hover:text-primary-ink"
                >
                  Ver todo
                </Link>
              </div>

              <ul className="flex flex-col gap-3.5">
                {categorias.slice(0, 6).map((c) => (
                  <li key={c.categoria}>
                    <div className="mb-1.5 flex items-baseline gap-2 text-sm">
                      <span className="font-medium">
                        {RUBRO_LABEL[c.categoria]}
                      </span>
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatMonto(c.pagado.usd, "USD")}{" "}
                        <span className="text-subtle">
                          / {formatMonto(c.previsto.usd, "USD")}
                        </span>
                      </span>
                    </div>
                    <div className="relative flex h-5 overflow-hidden rounded-lg bg-muted">
                      <div
                        className="bg-data"
                        style={{
                          width: `${(c.pagado.usd / maxCategoria) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-data-soft"
                        style={{
                          width: `${(Math.max(0, c.previsto.usd - c.pagado.usd) / maxCategoria) * 100}%`,
                        }}
                      />
                      {c.excedido && (
                        <span
                          className="absolute inset-y-0 w-0.5 bg-danger"
                          style={{
                            left: `${(c.estimado.usd / maxCategoria) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    {c.excedido && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Se pasó{" "}
                        {formatMonto(c.previsto.usd - c.estimado.usd, "USD")} de
                        lo estimado
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-4 border-t border-border-soft pt-3 text-[11px] text-subtle">
                <Leyenda clase="bg-data" texto="Pagado" />
                <Leyenda clase="bg-data-soft" texto="Falta pagar" />
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-0.5 bg-danger" />
                  Estimado original
                </span>
              </div>
            </Card>
          )}

          {(vencidas.length > 0 || estaSemana.length > 0) && (
            <Card>
              <div className="mb-3 flex items-baseline gap-2.5">
                <CardTitle>Esta semana</CardTitle>
                <span className="text-xs text-subtle">
                  {abiertas.length} abiertas
                </span>
                <Link
                  href="/tareas"
                  className="ml-auto text-xs font-semibold text-primary hover:text-primary-ink"
                >
                  Ver todas
                </Link>
              </div>
              <ul className="divide-y divide-border-soft">
                {[...vencidas, ...estaSemana].slice(0, 6).map((x) => {
                  const vencida = !!x.fecha_limite && x.fecha_limite < hoy;
                  return (
                    <li key={x.id}>
                      <Link
                        href="/tareas"
                        className="flex items-center gap-3 py-2.5 active:bg-muted"
                      >
                        <i className={cnBorde(vencida)} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {x.titulo}
                        </span>
                        <span
                          className={
                            vencida
                              ? "shrink-0 text-xs font-semibold tabular-nums text-danger"
                              : "shrink-0 text-xs tabular-nums text-muted-foreground"
                          }
                        >
                          {vencida ? "Venció " : ""}
                          {formatFecha(x.fecha_limite)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {proximos.length > 0 && (
            <Card>
              <div className="mb-3 flex items-baseline gap-2.5">
                <CardTitle>Próximos pagos</CardTitle>
                <Link
                  href="/pagos"
                  className="ml-auto text-xs font-semibold text-primary hover:text-primary-ink"
                >
                  Ver todos
                </Link>
              </div>
              <ul className="divide-y divide-border-soft">
                {proximos.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-sm font-semibold leading-tight tabular-nums">
                        {p.fecha.slice(8, 10)}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wide text-subtle">
                        {MES_CORTO[Number(p.fecha.slice(5, 7)) - 1]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {conceptoDe(p.budget_item_id)}
                      {p.fecha < hoy && (
                        <span className="font-semibold text-danger">
                          {" "}
                          · vencido
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMonto(p.monto, p.moneda)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-xs font-semibold text-warning">
                Total en 30 días
                <span className="ml-auto text-sm tabular-nums">
                  {formatMonto(totalProximos, "USD")}
                </span>
              </p>
            </Card>
          )}

          {v.length > 0 && (
            <Card>
              <div className="mb-3 flex items-baseline gap-2.5">
                <CardTitle>Proveedores</CardTitle>
                <span className="text-xs text-subtle">{v.length} en total</span>
                <Link
                  href="/proveedores"
                  className="ml-auto text-xs font-semibold text-primary hover:text-primary-ink"
                >
                  Ver todos
                </Link>
              </div>
              <div className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
                <Segmento
                  valor={contratados}
                  total={v.length}
                  clase="bg-success"
                />
                <Segmento
                  valor={conPresupuesto}
                  total={v.length}
                  clase="bg-sage"
                />
                <Segmento
                  valor={contactados}
                  total={v.length}
                  clase="bg-muted"
                />
              </div>
              <dl className="flex flex-col gap-2 text-sm">
                <FilaEstado
                  clase="bg-success"
                  label="Contratados"
                  valor={contratados}
                />
                <FilaEstado
                  clase="bg-sage"
                  label="Con presupuesto"
                  valor={conPresupuesto}
                />
                <FilaEstado
                  clase="bg-muted"
                  label="Sólo contactados"
                  valor={contactados}
                />
              </dl>
            </Card>
          )}

          {(ideas ?? []).length > 0 && (
            <Card>
              <div className="mb-3 flex items-baseline gap-2.5">
                <CardTitle>Ideas</CardTitle>
                <span className="text-xs text-subtle">
                  {(ideas ?? []).length} guardadas
                </span>
                <Link
                  href="/ideas"
                  className="ml-auto text-xs font-semibold text-primary hover:text-primary-ink"
                >
                  Ver todas
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ideasAprobadas > 0 && (
                  <Badge className="bg-success-soft text-success">
                    {ideasAprobadas} aprobadas
                  </Badge>
                )}
                {ideasEvaluando > 0 && (
                  <Badge className="bg-warning-soft text-warning">
                    {ideasEvaluando} evaluando
                  </Badge>
                )}
              </div>
            </Card>
          )}

          <Link
            href="/agenda-del-dia"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card active:bg-muted"
          >
            {actividades ? (
              <CalendarDays className="h-5 w-5 shrink-0 text-sage" />
            ) : (
              <Clock className="h-5 w-5 shrink-0 text-subtle" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                Agenda del día
              </span>
              <span className="block text-xs text-subtle">
                {actividades
                  ? `${actividades} actividades cargadas`
                  : "Todavía sin armar"}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
          </Link>
        </div>
      </section>
    </main>
  );
}

const MES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function sumarDias(iso: string, dias: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function cnBorde(vencida: boolean) {
  return vencida
    ? "h-4.5 w-4.5 shrink-0 rounded-md border-2 border-danger"
    : "h-4.5 w-4.5 shrink-0 rounded-md border-2 border-border";
}

function DatoHero({
  label,
  valor,
  detalle,
}: {
  label: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div>
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
        {valor}{" "}
        <span className="text-sm font-medium text-subtle">{detalle}</span>
      </dd>
    </div>
  );
}

function Tarjeta({
  href,
  titulo,
  children,
}: {
  href: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-3.5 shadow-card transition-colors active:bg-muted lg:p-4"
    >
      <span className="mb-2 flex items-center gap-2">
        <Eyebrow className="text-muted-foreground">{titulo}</Eyebrow>
        <ChevronRight className="ml-auto h-4 w-4 text-subtle" />
      </span>
      {children}
    </Link>
  );
}

function Segmento({
  valor,
  total,
  clase,
}: {
  valor: number;
  total: number;
  clase: string;
}) {
  if (valor <= 0) return null;
  return (
    <div
      className={`${clase} first:rounded-l-full last:rounded-r-full`}
      style={{ width: `${total > 0 ? (valor / total) * 100 : 0}%` }}
    />
  );
}

function FilaEstado({
  clase,
  label,
  valor,
}: {
  clase: string;
  label: string;
  valor: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <i className={`h-2 w-2 shrink-0 rounded-[2px] ${clase}`} />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${clase}`} />
      {texto}
    </span>
  );
}
