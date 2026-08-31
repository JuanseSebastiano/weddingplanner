import type { NuevoInvitado } from "@/app/(app)/invitados/actions";

/**
 * Parsea texto pegado desde una planilla o un CSV.
 * Acepta una columna (sólo nombres) o varias, con o sin encabezado.
 * Columnas reconocidas: nombre, grupo, lado, email, telefono, rsvp,
 * acompanantes, menu, notas.
 */
export function parsearInvitados(texto: string) {
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length === 0) return { filas: [], errores: [] };

  const sep = detectarSeparador(lineas[0]);
  const celdas = lineas.map((l) => partirLinea(l, sep));

  const encabezado = detectarEncabezado(celdas[0]);
  const cuerpo = encabezado ? celdas.slice(1) : celdas;
  const cols = encabezado ?? ["nombre"];

  const filas: NuevoInvitado[] = [];
  const errores: string[] = [];

  cuerpo.forEach((fila, i) => {
    const valor = (col: string) => {
      const idx = cols.indexOf(col);
      return idx === -1 ? "" : (fila[idx] ?? "").trim();
    };

    const nombre = valor("nombre") || fila[0]?.trim() || "";
    if (!nombre) {
      errores.push(`Línea ${i + 1 + (encabezado ? 1 : 0)}: sin nombre`);
      return;
    }

    filas.push({
      nombre,
      grupo: valor("grupo") || null,
      lado: valor("lado").toLowerCase().startsWith("novia") ? "novia" : "novio",
      email: valor("email") || null,
      telefono: valor("telefono") || null,
      rsvp: parsearRsvp(valor("rsvp")),
      acompanantes: Number.parseInt(valor("acompanantes"), 10) || 0,
      menu: parsearMenu(valor("menu")),
      menu_detalle: null,
      alojamiento: false,
      notas: valor("notas") || null,
    });
  });

  return { filas, errores };
}

function detectarSeparador(linea: string) {
  if (linea.includes("\t")) return "\t";
  if (linea.includes(";")) return ";";
  if (linea.includes(",")) return ",";
  return "\t";
}

function partirLinea(linea: string, sep: string) {
  // CSV con comillas: "Pérez, Juan",familia
  const out: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === sep && !entreComillas) {
      out.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  out.push(actual);
  return out;
}

const ALIAS: Record<string, string> = {
  nombre: "nombre",
  nombres: "nombre",
  invitado: "nombre",
  grupo: "grupo",
  familia: "grupo",
  lado: "lado",
  email: "email",
  mail: "email",
  correo: "email",
  telefono: "telefono",
  tel: "telefono",
  celular: "telefono",
  rsvp: "rsvp",
  estado: "rsvp",
  acompanantes: "acompanantes",
  acompaniantes: "acompanantes",
  menu: "menu",
  notas: "notas",
  nota: "notas",
  observaciones: "notas",
};

function detectarEncabezado(fila: string[]) {
  const normalizadas = fila.map((c) =>
    c
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );

  const reconocidas = normalizadas.filter((c) => ALIAS[c]).length;
  if (reconocidas < 1 || !normalizadas.some((c) => ALIAS[c] === "nombre")) {
    return null;
  }
  return normalizadas.map((c) => ALIAS[c] ?? c);
}

function parsearRsvp(v: string): NuevoInvitado["rsvp"] {
  const s = v.toLowerCase();
  if (s.startsWith("conf") || s === "si" || s === "sí") return "confirmado";
  if (s.startsWith("rech") || s === "no") return "rechazado";
  return "pendiente";
}

function parsearMenu(v: string): NuevoInvitado["menu"] {
  const s = v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.startsWith("veg")) return "vegetariano";
  if (s.startsWith("cel") || s.includes("sin tacc")) return "celiaco";
  if (s && s !== "ninguno" && s !== "-") return "otro";
  return "ninguno";
}
