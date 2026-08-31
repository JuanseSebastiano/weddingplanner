import type { Rubro } from "@/lib/format";

type Plantilla = {
  /** Meses antes del casamiento. 0 = el día del evento. */
  mesesAntes: number;
  /** Días antes, para la semana previa. */
  diasAntes?: number;
  titulo: string;
  categoria: Rubro;
  prioridad: "alta" | "media" | "baja";
};

/** Checklist estándar de casamiento, para sembrar al arrancar. Todo editable después. */
export const PLANTILLA: Plantilla[] = [
  { mesesAntes: 12, titulo: "Definir fecha y cantidad de invitados", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 12, titulo: "Definir presupuesto total", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 12, titulo: "Armar la lista preliminar de invitados", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 12, titulo: "Visitar salones y pedir presupuestos", categoria: "salon", prioridad: "alta" },
  { mesesAntes: 12, titulo: "Reservar el salón y señarlo", categoria: "salon", prioridad: "alta" },

  { mesesAntes: 9, titulo: "Sacar turno en el civil", categoria: "civil_iglesia", prioridad: "alta" },
  { mesesAntes: 9, titulo: "Reservar iglesia o ceremonia, si va", categoria: "civil_iglesia", prioridad: "media" },
  { mesesAntes: 9, titulo: "Contratar fotógrafo y video", categoria: "fotografia", prioridad: "alta" },
  { mesesAntes: 9, titulo: "Contratar música o DJ", categoria: "musica", prioridad: "alta" },
  { mesesAntes: 9, titulo: "Elegir y encargar el vestido", categoria: "vestimenta", prioridad: "alta" },
  { mesesAntes: 9, titulo: "Definir el catering y probar el menú", categoria: "catering", prioridad: "alta" },

  { mesesAntes: 6, titulo: "Encargar el traje del novio", categoria: "vestimenta", prioridad: "media" },
  { mesesAntes: 6, titulo: "Definir decoración y flores", categoria: "decoracion", prioridad: "media" },
  { mesesAntes: 6, titulo: "Reservar alojamiento para los de afuera", categoria: "otros", prioridad: "media" },
  { mesesAntes: 6, titulo: "Definir transporte para invitados", categoria: "transporte", prioridad: "media" },
  { mesesAntes: 6, titulo: "Diseñar y mandar las invitaciones", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 6, titulo: "Elegir las alianzas", categoria: "otros", prioridad: "media" },

  { mesesAntes: 3, titulo: "Cerrar la lista definitiva de invitados", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 3, titulo: "Seguimiento de confirmaciones (RSVP)", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 3, titulo: "Prueba de vestido y traje", categoria: "vestimenta", prioridad: "media" },
  { mesesAntes: 3, titulo: "Prueba de peinado y maquillaje", categoria: "vestimenta", prioridad: "media" },
  { mesesAntes: 3, titulo: "Reservar el viaje de luna de miel", categoria: "otros", prioridad: "media" },
  { mesesAntes: 3, titulo: "Elegir la torta y la mesa dulce", categoria: "catering", prioridad: "media" },

  { mesesAntes: 1, titulo: "Armar las mesas y el plano del salón", categoria: "salon", prioridad: "alta" },
  { mesesAntes: 1, titulo: "Pasar menús especiales al catering", categoria: "catering", prioridad: "alta" },
  { mesesAntes: 1, titulo: "Armar la lista de temas para la música", categoria: "musica", prioridad: "media" },
  { mesesAntes: 1, titulo: "Definir el cronograma del día", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 1, titulo: "Confirmar horarios con todos los proveedores", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 1, titulo: "Pagar saldos que vencen antes del evento", categoria: "otros", prioridad: "alta" },

  { mesesAntes: 0, diasAntes: 7, titulo: "Pasar el número final de invitados al salón", categoria: "salon", prioridad: "alta" },
  { mesesAntes: 0, diasAntes: 7, titulo: "Retirar vestido y traje", categoria: "vestimenta", prioridad: "alta" },
  { mesesAntes: 0, diasAntes: 7, titulo: "Confirmar traslados del día", categoria: "transporte", prioridad: "alta" },
  { mesesAntes: 0, diasAntes: 5, titulo: "Preparar los sobres para pagar el día del evento", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 0, diasAntes: 2, titulo: "Armar el bolso para el día", categoria: "otros", prioridad: "media" },

  { mesesAntes: 0, diasAntes: 0, titulo: "Entregar alianzas y documentos a quien corresponda", categoria: "otros", prioridad: "alta" },
  { mesesAntes: 0, diasAntes: 0, titulo: "Disfrutar", categoria: "otros", prioridad: "alta" },
];

/**
 * Retrocalcula cada fecha límite desde la fecha del casamiento.
 * Si el casamiento está a más de un año, los hitos más lejanos caerían en el
 * pasado: esos quedan con fecha de hoy, para que aparezcan como pendientes y
 * no como vencidos.
 */
export function tareasDesdePlantilla(fechaBoda: string, hoy: string) {
  return PLANTILLA.map((t) => {
    const fecha = new Date(fechaBoda.slice(0, 10) + "T00:00:00");
    if (t.mesesAntes > 0) fecha.setMonth(fecha.getMonth() - t.mesesAntes);
    if (t.diasAntes) fecha.setDate(fecha.getDate() - t.diasAntes);

    const iso = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      titulo: t.titulo,
      categoria: t.categoria,
      prioridad: t.prioridad,
      responsable: "ambos" as const,
      estado: "pendiente" as const,
      fecha_limite: iso < hoy ? hoy : iso,
    };
  });
}
