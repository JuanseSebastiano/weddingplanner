/**
 * Reemplazo mínimo de Express para correr los routers de finanzas dentro de
 * un route handler de Next.
 *
 * Los routers se portaron tal cual desde el backend Express: solo usan
 * `Router().get/post/put/patch/delete(path, ...handlers)`, `req.params`,
 * `req.query`, `req.body`, `req.header()` y `res.status/json/end/redirect`.
 * Este módulo implementa exactamente eso y nada más, para no reescribir
 * cada endpoint.
 */
import { HttpError } from './lib/errors';

export interface Request {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  header(name: string): string | undefined;
}

export interface Response {
  status(code: number): Response;
  json(body: unknown): void;
  end(): void;
  redirect(url: string): void;
}

export type NextFunction = (err?: unknown) => void;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => unknown;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handlers: RequestHandler[];
}

export interface RouterInstance {
  routes: Route[];
  get(path: string, ...handlers: RequestHandler[]): void;
  post(path: string, ...handlers: RequestHandler[]): void;
  put(path: string, ...handlers: RequestHandler[]): void;
  patch(path: string, ...handlers: RequestHandler[]): void;
  delete(path: string, ...handlers: RequestHandler[]): void;
}

/** "/:id/confirm" -> /^\/([^/]+)\/confirm\/?$/ con keys ["id"]. */
function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) {
        keys.push(part.slice(1));
        return '([^/]+)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { pattern: new RegExp(`^${source === '/' ? '' : source}/?$`), keys };
}

export function Router(): RouterInstance {
  const routes: Route[] = [];
  const add =
    (method: Method) =>
    (path: string, ...handlers: RequestHandler[]) => {
      routes.push({ method, handlers, ...compile(path) });
    };
  return {
    routes,
    get: add('GET'),
    post: add('POST'),
    put: add('PUT'),
    patch: add('PATCH'),
    delete: add('DELETE'),
  };
}

interface Mount {
  prefix: string;
  router: RouterInstance;
  /** Middlewares que corren antes de cada ruta del router (p. ej. auth). */
  before?: RequestHandler[];
}

function queryObject(url: URL): Request['query'] {
  const query: Request['query'] = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}

/**
 * Resuelve el pedido contra los routers montados y devuelve la Response.
 * `basePath` es el prefijo del route handler (p. ej. "/api/fin").
 */
export async function dispatch(
  request: globalThis.Request,
  basePath: string,
  mounts: Mount[],
): Promise<globalThis.Response> {
  const url = new URL(request.url);
  const fullPath = url.pathname.slice(basePath.length) || '/';
  const method = request.method.toUpperCase() as Method;

  let body: unknown = undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return Response.json({ error: 'JSON inválido' }, { status: 400 });
      }
    }
  }

  let result: globalThis.Response | null = null;
  let status = 200;
  const res: Response = {
    status(code) {
      status = code;
      return res;
    },
    json(payload) {
      result = Response.json(payload, { status });
    },
    end() {
      result = new Response(null, { status });
    },
    redirect(location) {
      result = new Response(null, { status: 302, headers: { Location: location } });
    },
  };

  try {
    for (const mount of mounts) {
      if (fullPath !== mount.prefix && !fullPath.startsWith(mount.prefix + '/')) continue;
      const path = fullPath.slice(mount.prefix.length) || '/';

      for (const route of mount.router.routes) {
        if (route.method !== method) continue;
        const match = route.pattern.exec(path);
        if (!match) continue;

        const params: Record<string, string> = {};
        route.keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1]!)));

        const req: Request = {
          method,
          path,
          params,
          query: queryObject(url),
          body,
          header: (name) => request.headers.get(name) ?? undefined,
        };

        await runChain([...(mount.before ?? []), ...route.handlers], req, res);
        if (result) return result;
      }
    }
    return Response.json({ error: 'Ruta no encontrada' }, { status: 404 });
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message, details: err.details }, { status: err.status });
    }
    console.error('Error no controlado:', err);
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return Response.json(
      { error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : message },
      { status: 500 },
    );
  }
}

/** Corre los handlers en orden; cada uno sigue con next() o corta respondiendo. */
async function runChain(handlers: RequestHandler[], req: Request, res: Response): Promise<void> {
  for (const handler of handlers) {
    let advanced = false;
    let failure: unknown = undefined;
    await new Promise<void>((resolve) => {
      const next: NextFunction = (err) => {
        advanced = true;
        failure = err;
        resolve();
      };
      Promise.resolve(handler(req, res, next)).then(() => resolve(), (err) => {
        failure = err;
        advanced = true;
        resolve();
      });
    });
    if (failure !== undefined) throw failure;
    if (!advanced) return;
  }
}
