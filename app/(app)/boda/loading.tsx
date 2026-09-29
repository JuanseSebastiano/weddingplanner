/**
 * Se muestra apenas se toca una pestaña, mientras el servidor arma la página.
 * Sin esto, tocar el menú de abajo no da ninguna señal hasta que llegan los datos.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-label="Cargando" role="status">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-32 rounded bg-muted" />
      <div className="mt-4 h-24 rounded-xl bg-muted" />
      <div className="mt-3 space-y-2">
        <div className="h-14 rounded-xl bg-muted" />
        <div className="h-14 rounded-xl bg-muted" />
        <div className="h-14 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
