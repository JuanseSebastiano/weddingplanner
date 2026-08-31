import { createClient } from "@/lib/supabase/server";

const MENU_LABEL = {
  ninguno: "",
  vegetariano: "Vegetariano",
  celiaco: "Celíaco",
  otro: "Otro",
} as const;

const RSVP_LABEL = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "No viene",
} as const;

/** CSV para pasarle al salón o al catering. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select(
      "nombre, grupo, lado, email, telefono, rsvp, acompanantes, menu, menu_detalle, alojamiento, notas, tables(numero)",
    )
    .order("nombre");

  const filas = (data ?? []) as unknown as Array<{
    nombre: string;
    grupo: string | null;
    lado: string;
    email: string | null;
    telefono: string | null;
    rsvp: keyof typeof RSVP_LABEL;
    acompanantes: number;
    menu: keyof typeof MENU_LABEL;
    menu_detalle: string | null;
    alojamiento: boolean;
    notas: string | null;
    tables: { numero: number } | null;
  }>;

  const escapar = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const encabezado = [
    "Nombre",
    "Grupo",
    "Lado",
    "Email",
    "Teléfono",
    "RSVP",
    "Acompañantes",
    "Menú",
    "Detalle menú",
    "Alojamiento",
    "Mesa",
    "Notas",
  ];

  const lineas = [
    encabezado.join(","),
    ...filas.map((g) =>
      [
        g.nombre,
        g.grupo,
        g.lado === "novio" ? "Novio" : "Novia",
        g.email,
        g.telefono,
        RSVP_LABEL[g.rsvp],
        g.acompanantes,
        MENU_LABEL[g.menu],
        g.menu_detalle,
        g.alojamiento ? "Sí" : "",
        g.tables ? `Mesa ${g.tables.numero}` : "",
        g.notas,
      ]
        .map(escapar)
        .join(","),
    ),
  ];

  // BOM para que Excel abra los acentos bien.
  return new Response("﻿" + lineas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitados.csv"',
    },
  });
}
