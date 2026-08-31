# Wedding Planner

App privada para organizar nuestro casamiento (dos usuarios). Reemplaza
planillas, notas y chats: invitados y mesas, presupuesto y pagos en ARS/USD,
tareas, proveedores, ideas y agenda del día.

**Casamiento:** 02/04/2027 en Solís, Provincia de Buenos Aires · presupuesto
objetivo USD 10.000 · ~100 invitados.

**Stack:** Next.js 16 (App Router, TypeScript, Server Actions) · Supabase
(Postgres, Auth, Storage, RLS) · Tailwind CSS v4 · Vercel.

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/` | Cuenta regresiva y tarjetas de presupuesto, invitados, tareas y próximos pagos, todas clickeables |
| `/invitados` | Alta rápida, importación pegando planilla o CSV, filtros, contadores y export a CSV |
| `/mesas` | Armado de mesas con capacidad, drag-and-drop en escritorio y selección múltiple en celular |
| `/presupuesto` | Estimado vs real vs pagado vs pendiente por categoría, en ARS y USD, con curva de gasto |
| `/pagos` | Señas y cuotas, cotización usada por pago, vencimientos a 30 días y comprobantes |
| `/tareas` | Lista, "esta semana" y calendario mensual, más el checklist estándar retrocalculado |
| `/agenda-del-dia` | Cronograma hora por hora del evento, imprimible o guardable en PDF |
| `/proveedores` | Fichas por rubro con contacto, puntaje, notas y presupuestos adjuntos |
| `/comparador` | Presupuestos del mismo rubro lado a lado, normalizados a dólares |
| `/ideas` | Galería de fotos y links con estado (idea, evaluando, aprobada, descartada) |

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

No hay más variables: no se usa la service role key en ningún lado.

El proyecto de Supabase de esta app es **`wedding-planner`**
(ref `xmzrpudvjyangiirrpmo`, región São Paulo, plan free).

## Migraciones

Están versionadas en `supabase/migrations/` y se aplican en orden:

| Archivo | Qué hace |
| --- | --- |
| `0001_schema.sql` | Tablas, enums e índices |
| `0002_rls.sql` | RLS en todas las tablas, bucket de Storage y funciones de acceso |
| `0003_seed.sql` | La boda y los dos emails habilitados |
| `0004_harden.sql` | Permisos de las funciones `security definer` |

Con la CLI de Supabase, contra el proyecto remoto:

```bash
npx supabase link --project-ref xmzrpudvjyangiirrpmo
npx supabase db push
```

O pegando cada archivo, en orden, en el SQL Editor del dashboard. **Ya están
aplicadas** en el proyecto: esto es para recrearlo desde cero si hiciera falta.

### Cómo funciona el acceso

- Login con **magic link**. Antes de mandarlo, la app pregunta por RPC si el
  email está en `wedding_members`; si no está, no se envía nada.
- Toda tabla tiene RLS: sólo se ven las filas cuyo `wedding_id` corresponde a un
  `wedding_members` con tu email o `user_id`. Aunque alguien se cree un usuario
  por fuera, no ve una sola fila (verificado: un usuario autenticado que no es
  miembro lee 0 filas y sus INSERT son rechazados por la policy).
- Los archivos van al bucket privado `files` bajo el prefijo `{wedding_id}/…`,
  con la misma regla, y se muestran con URLs firmadas de vida corta.

Para cambiar quién entra, se edita la tabla `wedding_members`, no el código.

## Deploy en Vercel

1. Importar el repo en Vercel (framework Next.js, se detecta solo).
2. Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   Settings → Environment Variables (Production, Preview y Development).
3. Deploy.
4. En Supabase → Authentication → URL Configuration:
   - **Site URL**: el dominio de Vercel.
   - **Redirect URLs**: agregar `https://<dominio>/auth/callback` y, para
     desarrollo, `http://localhost:3000/auth/callback`.

   Sin este paso el magic link redirige a la URL equivocada y el login falla.

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run lint    # eslint
```

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
