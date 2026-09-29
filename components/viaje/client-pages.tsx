'use client'

// Las páginas leen IndexedDB con useLiveQuery: en el servidor no hay datos
// y renderizan vacío; en el navegador se completan, con o sin red.
export { default as Itinerario } from './pages/Itinerario'
export { default as Vuelos } from './pages/Vuelos'
export { default as Trenes } from './pages/Trenes'
export { default as Reservas } from './pages/Reservas'
export { default as Crucero } from './pages/Crucero'
export { default as Gastos } from './pages/Gastos'
export { ViajeShell } from './shell'
export { default as Importar } from './pages/Importar'
