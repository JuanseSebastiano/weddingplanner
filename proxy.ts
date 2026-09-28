import { NextResponse } from "next/server";

export function proxy() {
  // Sin las variables de entorno la app no puede hablar con Supabase y toda
  // ruta daría un 500 sin explicación. Mejor decir qué falta.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return new NextResponse(
      "Falta configurar las variables de entorno NEXT_PUBLIC_SUPABASE_URL y " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY.\n\n" +
        "En Vercel: Settings → Environment Variables → cargarlas para " +
        "Production, Preview y Development, y después volver a deployar " +
        "(Deployments → ... → Redeploy), porque las variables NEXT_PUBLIC_ se " +
        "toman en el momento del build.\n\n" +
        "En local: copiar .env.example a .env.local y completarlas.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)$).*)"],
};
