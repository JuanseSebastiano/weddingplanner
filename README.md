# Wedding Planner

App para organizar nuestro casamiento. Reemplaza planillas, notas y chats:
invitados y mesas, presupuesto y pagos en ARS/USD, tareas, proveedores, ideas y
agenda del día.

**Casamiento:** 02/04/2027 en Solís, Provincia de Buenos Aires · presupuesto
objetivo USD 10.000 · ~100 invitados.

**Stack:** Next.js 16 (App Router, TypeScript, Server Actions) · Supabase
(Postgres, Storage) · Tailwind CSS v4 · Vercel.

**Acceso:** login con email y contraseña (Supabase Auth). Cada usuario
pertenece a una pareja (`couple_members`) y RLS limita todo a los datos de su
pareja.

**Estructura:** una sola app con módulos `/` (inicio), `/boda`, `/finanzas` y
`/viaje`. Navegación inferior en celular y lateral en escritorio.

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/boda` | Cuenta regresiva y tarjetas de presupuesto, invitados, tareas y próximos pagos, todas clickeables |
| `/boda/invitados` | Alta rápida, importación pegando planilla o CSV, filtros, contadores y export a CSV |
| `/boda/mesas` | Armado de mesas con capacidad, drag-and-drop en escritorio y selección múltiple en celular |
| `/boda/presupuesto` | Estimado vs real vs pagado vs pendiente por categoría, en ARS y USD, con curva de gasto |
| `/boda/pagos` | Señas y cuotas, cotización usada por pago, vencimientos a 30 días y comprobantes |
| `/boda/tareas` | Lista, "esta semana" y calendario mensual, más el checklist estándar retrocalculado |
| `/boda/agenda-del-dia` | Cronograma hora por hora del evento, imprimible o guardable en PDF |
| `/boda/proveedores` | Fichas por rubro con contacto, puntaje, notas y presupuestos adjuntos |
| `/boda/comparador` | Presupuestos del mismo rubro lado a lado, normalizados a dólares |
| `/boda/ideas` | Galería de fotos y links con estado (idea, evaluando, aprobada, descartada) |

## Finanzas (`/finanzas`)

Portado de Nuestras Finanzas. La UI son las mismas páginas (componentes
cliente con react-query) en `components/finanzas/`; la API Express vive en
`lib/finanzas/server/` y la sirve el route handler `app/api/fin/[...path]`
a través de un adaptador mínimo (`lib/finanzas/server/http.ts`), así los
routers quedaron casi textuales.

| Ruta | Qué hace |
| --- | --- |
| `/finanzas` | Disponible real, total del mes, rubros, reparto entre los dos y tendencia |
| `/finanzas/gastos` | Gastos con filtros, alta y edición |
| `/finanzas/balance` | Ingresos y egresos del mes y listado unificado |
| `/finanzas/ahorros` | Caja de ahorro y cartera |
| `/finanzas/revision` | Gastos detectados en mails: nada se imputa sin confirmarlo acá |
| `/finanzas/configuracion` | Gmail, rubros, presupuestos, reglas, cuentas (saldo, cierre y vencimiento) |

**Disponible real** = saldo líquido cargado en las cuentas − deuda de tarjeta
impaga (vistas `fin_available_now` y `fin_card_debt`). De cada tarjeta se
cuenta lo posterior al último cierre si ese resumen ya venció, o lo posterior
al cierre anterior si todavía no.

**Gmail**: el cron diario (`vercel.json`) llama a `/api/fin/gmail/cron` con
`Authorization: Bearer $CRON_SECRET`. Cada mail reconocido entra como gasto
`pending` y recién suma cuando alguien lo confirma en Revisión.

```bash
npm test   # tests de parsers, reglas, balance, presupuestos y cartera
```

## Integraciones entre módulos

Vistas SQL (`0009_integraciones.sql`), sin duplicar datos:

- `fin_commitments`: pagos pendientes de la boda, lo que falta pagar del
  viaje y los resúmenes de tarjeta por pagar, con vencimiento, monto,
  moneda y link al módulo. Se muestran en el resumen de Finanzas.
- `trip_budget`: presupuesto del viaje (vuelos, trenes, reservas, crucero)
  por moneda, pagado y pendiente, también en Finanzas.
- Alerta en Finanzas si el disponible real proyectado a la fecha del próximo
  pago de la boda (disponible real menos los compromisos que vencen antes)
  no alcanza para ese pago. Todo se compara en pesos, con la cotización del
  pago o la de referencia de la boda.

## Viaje (`/viaje`)

Portado de Luna de Miel: itinerario, vuelos, trenes, reservas, crucero y
gastos (`components/viaje/`). Funciona sin red:

- Los datos se leen de IndexedDB (Dexie) en el dispositivo.
- Cada cambio local queda en un outbox y `components/viaje/sync.ts` lo sube
  a las tablas `trip_*` apenas hay conexión; después baja lo que cambió en
  el servidor desde el último `updated_at`. Los borrados son lógicos
  (`deleted_at`) para que lleguen a los otros dispositivos.
- El service worker (`public/sw.js`) guarda las secciones del viaje con sus
  scripts, así abren offline aunque no se hayan visitado.
- Lo que tiene precio guarda monto, moneda (ARS/USD), cotización, si está
  pagado y cuándo vence. Un monto en euros se guarda convertido a dólares con
  la cotización ingresada, y el original queda en las notas.

Toda la app es instalable (`app/manifest.ts`).

## Migración de datos desde las apps viejas

**Finanzas** (proyecto Supabase de Nuestras Finanzas → tablas `fin_*`):

```bash
OLD_SUPABASE_URL=... OLD_SUPABASE_SERVICE_ROLE_KEY=... \
NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... \
COUPLE_ID=11111111-1111-1111-1111-111111111111 \
node scripts/migrar-finanzas.mjs          # dry-run: conteo por tabla, no escribe
node scripts/migrar-finanzas.mjs --apply  # escribe
```

Empareja usuarios por email con `couple_members`, conserva los ids (correrlo
dos veces no duplica), reutiliza los rubros que ya existen y no escribe nada
si encuentra un problema. Las credenciales de Gmail se copian cifradas: el
proyecto nuevo tiene que usar el mismo `GMAIL_TOKEN_ENCRYPTION_KEY`.

**Viaje** (Luna de Miel guarda todo en el teléfono): en la app vieja,
💾 → Exportar respaldo; en la nueva, `/viaje/importar`. Muestra primero qué
entra por tabla y recién con "Importar" escribe. Solo importa en un viaje
vacío. Los precios en texto se convierten a monto y moneda (euros a dólares
con la cotización que se indica); lo ilegible queda en notas.

## Setup local

```bash
npm install
cp .env.example .env.local   # completar con los datos de Supabase
npm run dev                  # http://localhost:3000
```

### Variables de entorno

| Variable | Dónde se saca | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (publishable) | Cliente público; los datos los protege RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys (secret) | API de finanzas y cron, solo servidor |
| `CRON_SECRET` | Generarlo (`openssl rand -hex 32`) | Autoriza el cron de Gmail |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GMAIL_TOKEN_ENCRYPTION_KEY` | Google Cloud Console / `openssl rand -hex 32` | Ingesta de mails (opcional) |

El proyecto de Supabase de esta app es **`wedding-planner`**
(ref `xmzrpudvjyangiirrpmo`, región São Paulo, plan free).

## Migraciones

Están versionadas en `supabase/migrations/` y se aplican en orden:

| Archivo | Qué hace |
| --- | --- |
| `0001_schema.sql` | Tablas, enums e índices |
| `0002_rls.sql` | RLS en todas las tablas, bucket de Storage y funciones de acceso |
| `0003_seed.sql` | La boda y los dos emails (histórico; ya no se usan para login) |
| `0004_harden.sql` | Permisos de las funciones `security definer` |
| `0005_open_access.sql` | Saca el login: las policies quedan abiertas a `anon` |
| `0006_couples.sql` | `couples`/`couple_members`, prefijo `wedding_` en las tablas, `couple_id` en todas y RLS por pareja (revierte 0005) |
| `0007_finanzas.sql` | Tablas `fin_*`, RLS por pareja, rubros por defecto y vistas del disponible real |
| `0008_viaje.sql` | Tablas `trip_*` con id uuid, `updated_at` del servidor, `deleted_at` y RLS por pareja |
| `0009_integraciones.sql` | Vistas `fin_commitments`, `fin_card_next_due` y `trip_budget` |

Con la CLI de Supabase, contra el proyecto remoto:

```bash
npx supabase link --project-ref xmzrpudvjyangiirrpmo
npx supabase db push
```

O pegando cada archivo, en orden, en el SQL Editor del dashboard. **0001–0005 ya
están aplicadas** en el proyecto; 0006 en adelante se prueban primero en un
entorno aparte y se aplican a producción con OK explícito.

### Cómo funciona el acceso

Login con email y contraseña. No hay registro público: los usuarios se crean
en Supabase → Authentication → Users y se vinculan a su pareja con una fila en
`couple_members` (`user_id`).

Todas las tablas de dominio tienen `couple_id` (con default `my_couple_id()`,
así los inserts no necesitan mandarlo) y una policy
`is_couple_member(couple_id)` para `authenticated`. Storage usa el mismo
criterio con el primer segmento del path. La boda existente quedó con
`couple_id = wedding_id`.

`supabase/tests/rls_parejas.sql` verifica que un usuario de otra pareja no ve
ni modifica nada (corre en una transacción con rollback):

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_parejas.sql
```

## Deploy en Vercel

1. Importar el repo en Vercel (framework Next.js, se detecta solo).
2. Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   Settings → Environment Variables (Production, Preview y Development).
3. Deploy.

En Supabase → Authentication → Sign In / Providers: dejar Email habilitado y
desactivar "Allow new users to sign up".

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run lint    # eslint
```

## Foto de portada

El dashboard (`/`) muestra una foto de fondo detrás de la cuenta regresiva.
Para cargarla: guardar el archivo como `public/portada.jpg` (formato horizontal,
1200px de ancho o más) y hacer commit — no hace falta tocar código. Sin el
archivo, se ve un fondo de color en su lugar.

## Notas de implementación

- **Dual ARS/USD**: cada monto guarda su moneda. Un pago en dólares guarda además
  la cotización de ese día y se usa esa para expresarlo en pesos; los pagos en
  pesos usan la cotización de referencia de la boda, editable desde
  `/presupuesto`. Los totales se muestran siempre en las dos monedas.
- **Checklist estándar**: la plantilla vive en `lib/plantilla-tareas.ts` y se
  retrocalcula desde la fecha del casamiento. Los hitos que caerían en el pasado
  (porque falta más de un año) quedan con fecha de hoy en vez de nacer vencidos.
  Sembrarlo de nuevo no duplica lo que ya existe.
- **Componentes de UI**: escritos en `components/ui/` siguiendo las convenciones
  de shadcn/ui sobre Radix, porque el registry de shadcn no era alcanzable desde
  el entorno donde se construyó. Se editan como cualquier archivo del proyecto.
- **Export a PDF** de la agenda del día: se imprime desde el navegador
  (Compartir → Imprimir → Guardar como PDF en el celular), sin dependencias.
