/*
 * Service worker de la app.
 *
 * - Assets de Next (/_next/static, inmutables): cache primero.
 * - Navegación y datos RSC: red primero; si no hay red, lo último guardado.
 *   Así /viaje abre offline (sus datos viven en IndexedDB) y el resto de la
 *   app muestra la última versión vista.
 * - /api y Supabase no se cachean: son datos vivos.
 */
const CACHE = "nosotros-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    // Una redirección (p. ej. a /login) no se guarda como la página pedida.
    if (response.ok && !response.redirected) {
      (await caches.open(CACHE)).put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await caches.match(request)) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    const fallback = url.pathname.startsWith("/viaje") ? "/viaje" : null;
    event.respondWith(networkFirst(request, fallback));
    return;
  }

  if (request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request, null));
  }
});
