import type { NextFunction, Request, RequestHandler, Response } from '../http';

/** Error con status HTTP, capturado por `dispatch` en http.ts. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);
export const unauthorized = (message = 'No autenticado') => new HttpError(401, message);
export const forbidden = (message = 'Sin permisos para esta operación') => new HttpError(403, message);
export const notFound = (message = 'No encontrado') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Envuelve handlers async para que los rechazos lleguen al error handler. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => fn(req as unknown as Req, res, next).catch(next);
}
