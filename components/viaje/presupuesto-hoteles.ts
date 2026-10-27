/*
 * Presupuesto de hoteles de la luna de miel (Hoteles_Luna_de_Miel_Europa_2027.xlsx).
 * Precios Booking al 10/10/2026, 2 adultos, impuestos incluidos, tarifa con
 * desayuno cuando existe. Son cotizaciones, no reservas: no van a Finanzas.
 * `top` / `eco` marcan la opción elegida en cada presupuesto; `eco` es el
 * US$/noche que se usa en el económico.
 */

export interface OpcionHotel {
  nombre: string
  precio: number | null // US$/noche
  desayuno: string
  distancia: string
  estado: string
  nota: string
  link: string
  top?: true
  eco?: number
}

export interface TramoHotel {
  ciudad: string
  fechas: string
  noches: number
  opciones: OpcionHotel[]
}

const bk = (slug: string, checkin: string, checkout: string) =>
  `https://www.booking.com/hotel/${slug}.es.html?checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1`

export const FECHA_PRESUPUESTO = '10/10/2026'

export const PRESUPUESTO_HOTELES: TramoHotel[] = [
  {
    ciudad: 'París',
    fechas: '05–06/04/2027',
    noches: 1,
    opciones: [
      { nombre: 'Hotel Joke – Astotel ★★★', precio: 229, desayuno: 'Sí', distancia: 'Metro Blanche/Trinité, a pasos', estado: 'Disponible', nota: 'Top: cumple los 3', link: bk('fr/joke-astotel', '2027-04-05', '2027-04-06'), top: true },
      { nombre: 'Hotel Acadia – Astotel ★★★', precio: 240, desayuno: 'Sí', distancia: 'Metro a pasos · ~1 km Gare du Nord', estado: 'Disponible', nota: '', link: bk('fr/acadiaopera', '2027-04-05', '2027-04-06') },
      { nombre: 'Hôtel Montholon ★★★★', precio: 167, desayuno: 'No (+US$11)', distancia: '~300 m metro Cadet', estado: 'Disponible', nota: 'Relaja (b)', link: bk('fr/montholon', '2027-04-05', '2027-04-06'), eco: 178 },
      { nombre: 'Bloom House Hotel & Spa ★★★★', precio: 291, desayuno: 'No', distancia: '~400 m Gare du Nord', estado: 'Disponible', nota: 'Supera presupuesto', link: bk('fr/bloom-house', '2027-04-05', '2027-04-06') },
      { nombre: 'Les Plumes Hotel ★★★', precio: null, desayuno: '—', distancia: '~350 m metro Cadet', estado: 'Sin disponibilidad', nota: '', link: bk('fr/les-plumes', '2027-04-05', '2027-04-06') },
    ],
  },
  {
    ciudad: 'Lagos de Como',
    fechas: '06–08/04/2027',
    noches: 2,
    opciones: [
      { nombre: 'Hotel Diffuso Il Portichetto (Varenna)', precio: 249, desayuno: 'Sí', distancia: '~1 km estación Varenna', estado: 'Disponible', nota: 'Top: romántico, piscina; relaja (c)', link: bk('it/casa-cristina-perledo', '2027-04-06', '2027-04-08'), top: true },
      { nombre: 'Aqua&Co Bellagio – B&B with love (Bellagio)', precio: 247, desayuno: 'Sí', distancia: 'Sin tren (ferry desde Varenna)', estado: 'Disponible', nota: 'Relaja (c)', link: bk('it/aqua-amp-co-bellagio', '2027-04-06', '2027-04-08') },
      { nombre: 'B&B Le Fate del Lago (Lierna)', precio: 139, desayuno: 'Sí', distancia: 'Lierna (línea Lecco–Varenna)', estado: 'Disponible', nota: 'Económica', link: bk('it/le-fate-del-lago', '2027-04-06', '2027-04-08'), eco: 139 },
      { nombre: 'Albergo Milano ★★★ (Varenna)', precio: null, desayuno: 'Sí', distancia: '~300 m estación', estado: 'Tarifas 2027 no publicadas', nota: 'Reconsultar ene/feb', link: bk('it/albergo-milano', '2027-04-06', '2027-04-08') },
    ],
  },
  {
    ciudad: 'Cinque Terre',
    fechas: '08–10/04/2027',
    noches: 2,
    opciones: [
      { nombre: 'Hotel Margherita ★★★', precio: 225, desayuno: 'Sí', distancia: '~600 m estación Monterosso', estado: 'Disponible', nota: 'Top: cancelación gratis hasta 1/4', link: bk('it/margherita-monterosso', '2027-04-08', '2027-04-10'), top: true },
      { nombre: 'Affittacamere Monterosso 5 Terre', precio: 214, desayuno: 'Sí', distancia: 'Cerca de la estación', estado: 'Disponible', nota: 'US$193 con Genius', link: bk('it/guesthousecinqueterre', '2027-04-08', '2027-04-10'), eco: 214 },
      { nombre: 'Hotel La Spiaggia ★★★', precio: null, desayuno: 'Sí', distancia: '~400 m estación', estado: 'Tarifas 2027 no publicadas', nota: '', link: bk('it/la-spiaggia', '2027-04-08', '2027-04-10') },
    ],
  },
  {
    ciudad: 'Florencia',
    fechas: '10–12/04/2027',
    noches: 2,
    opciones: [
      { nombre: 'Hotel David ★★★', precio: 204, desayuno: 'Sí', distancia: '~2 km SMN (bus)', estado: 'Disponible', nota: 'Top: relaja (c)', link: bk('it/david', '2027-04-10', '2027-04-12'), top: true, eco: 204 },
      { nombre: 'Canto degli Aranci', precio: 222, desayuno: 'Sí', distancia: '~1,5 km SMN', estado: 'Disponible', nota: 'Relaja (c)', link: bk('it/canto-degli-aranci', '2027-04-10', '2027-04-12') },
      { nombre: "B&B Lorenzo de' Medici", precio: 271, desayuno: 'Sí', distancia: 'Cerca de SMN', estado: 'Disponible', nota: 'Supera presupuesto', link: bk('it/lorenzo-de-39-medici', '2027-04-10', '2027-04-12') },
      { nombre: 'Hotel Burchianti ★★★★', precio: null, desayuno: 'Sí', distancia: '~600 m SMN', estado: 'Sin disponibilidad', nota: '', link: bk('it/burchianti', '2027-04-10', '2027-04-12') },
    ],
  },
  {
    ciudad: 'Roma',
    fechas: '12–13/04/2027',
    noches: 1,
    opciones: [
      { nombre: "B&B L'Esquilina", precio: 240, desayuno: 'Sí', distancia: '~400 m Termini', estado: 'Disponible', nota: 'Top: cumple los 3, cancelación gratis', link: bk('it/b-amp-b-l-esquilina', '2027-04-12', '2027-04-13'), top: true },
      { nombre: 'Eletta Guest House', precio: 190, desayuno: 'Sí', distancia: '~500 m metro Cipro', estado: 'Disponible', nota: '', link: bk('it/eletta-guest-house', '2027-04-12', '2027-04-13'), eco: 190 },
      { nombre: 'Hotel Laura ★★★', precio: null, desayuno: 'Sí', distancia: '<400 m Termini', estado: 'Sin disponibilidad', nota: '', link: bk('it/laura', '2027-04-12', '2027-04-13') },
    ],
  },
  {
    ciudad: 'Salerno',
    fechas: '13–17/04/2027',
    noches: 4,
    opciones: [
      { nombre: 'FORTUNA Suite & Terrace', precio: 175, desayuno: 'Sí', distancia: 'Casco antiguo, ~1 km estación', estado: 'Disponible', nota: 'Top romántico: estudio con terraza; relaja (c)', link: bk('it/fortuna-suite-amp-terrace', '2027-04-13', '2027-04-17'), top: true },
      { nombre: 'B&B Milleduecento Luxury Room', precio: 130, desayuno: 'Sí', distancia: '~1 km estación', estado: 'Disponible', nota: 'Relaja (c)', link: bk('it/b-amp-b-milleduecento-luxury-room', '2027-04-13', '2027-04-17'), eco: 130 },
      { nombre: 'Holiday Guesthouse', precio: 136, desayuno: 'Sí', distancia: '350 m del centro', estado: 'Disponible', nota: '', link: bk('it/holiday-guesthouse', '2027-04-13', '2027-04-17') },
      { nombre: 'Hotel Plaza ★★★', precio: null, desayuno: 'Sí', distancia: '<100 m estación', estado: 'Tarifas 2027 no publicadas', nota: '~US$140 en fechas cercanas; reconsultar', link: bk('it/plaza-salerno', '2027-04-13', '2027-04-17') },
    ],
  },
  {
    ciudad: 'Madrid',
    fechas: '25–30/04/2027',
    noches: 5,
    opciones: [
      { nombre: 'Apartosuites Jardines de Sabatini', precio: 245, desayuno: 'Sí', distancia: '400 m Príncipe Pío', estado: 'Disponible', nota: 'Top: cumple los 3', link: bk('es/apartosuite-jardines-de-sabatini', '2027-04-25', '2027-04-30'), top: true },
      { nombre: 'Suites Viena Plaza de España', precio: 209, desayuno: 'Sí', distancia: 'Cerca metro Ventura Rodríguez', estado: 'Disponible', nota: 'Cancelación gratis hasta 18/4', link: bk('es/suites-viena', '2027-04-25', '2027-04-30'), eco: 209 },
      { nombre: 'Acta Pirámides', precio: 215, desayuno: 'Sí', distancia: '20 m metro Pirámides', estado: 'Disponible', nota: 'Menos romántico', link: bk('es/actapiramides-hotel', '2027-04-25', '2027-04-30') },
      { nombre: 'Only YOU Hotel Atocha ★★★★', precio: null, desayuno: 'No', distancia: '~150 m Atocha', estado: 'Sin disponibilidad', nota: '', link: bk('es/only-you-atocha', '2027-04-25', '2027-04-30') },
    ],
  },
]
