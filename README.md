# Wedding Planner

App privada para organizar nuestro casamiento (2 usuarios). Reemplaza planillas,
notas y chats: invitados y mesas, presupuesto y pagos en ARS/USD, tareas,
proveedores, ideas y agenda del día.

**Stack:** Next.js (App Router, TypeScript, Server Actions) · Supabase (Postgres,
Auth, Storage, RLS) · Tailwind CSS · Vercel.

## Setup local

```bash
npm install
cp .env.example .env.local   # completar con los datos del proyecto de Supabase
npm run dev                  # http://localhost:3000
```

### Variables de entorno

| Variable | Dónde se saca | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (publishable) | Cliente público; los datos los protege RLS |

No hay más variables: no se usa la service role key en ningún lado.

## Migraciones

Las migraciones versionadas están en `supabase/migrations/`, en orden:

| Archivo | Qué hace |
| --- | --- |
| `0001_schema.sql` | Tablas, enums e índices |
| `0002_rls.sql` | RLS en todas las tablas, bucket de Storage y funciones de acceso |
| `0003_seed.sql` | La boda y los dos emails habilitados |
| `0004_harden.sql` | Permisos de las funciones `security definer` |

Con la CLI de Supabase, contra el proyecto remoto:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

O pegando cada archivo, en orden, en el SQL Editor del dashboard.

### Cómo funciona el acceso

- Login con **magic link**. Antes de mandarlo, la app pregunta por RPC si el
  email está en `wedding_members`; si no está, no se envía nada.
- Toda tabla tiene RLS: sólo se ven las filas cuyo `wedding_id` corresponde a un
  `wedding_members` con tu email o `user_id`. Aunque alguien se cree un usuario
  por fuera, no ve una sola fila.
- Los archivos van al bucket privado `files` bajo el prefijo `{wedding_id}/…`,
  con la misma regla.

Para cambiar quién entra, editá `wedding_members` (tabla, no código).

## Deploy en Vercel

1. Importar el repo en Vercel (framework Next.js, se detecta solo).
2. Cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   Settings → Environment Variables (Production, Preview y Development).
3. Deploy.
4. En Supabase → Authentication → URL Configuration, poner el dominio de Vercel
   como **Site URL** y agregar `https://<dominio>/auth/callback` en **Redirect
   URLs**. Sin esto el magic link vuelve a `localhost`.

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run lint    # eslint
```
