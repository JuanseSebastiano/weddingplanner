import { useEffect, useState } from 'react';

/**
 * Los dos cortes del diseño:
 *
 * - `compact` (<980px): el layout pasa a una columna y la barra lateral se
 *   reemplaza por la navegación inferior.
 * - `cards` (<1050px): la tabla de gastos se vuelve lista de tarjetas. El
 *   corte es más alto que `compact` porque la columna de rubro —que es la
 *   identidad del gasto— empieza a recortarse antes de que el layout se
 *   rompa.
 */
export interface Breakpoint {
  width: number;
  compact: boolean;
  cards: boolean;
}

function read(): Breakpoint {
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
  return { width, compact: width < 980, cards: width < 1050 };
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(read);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBreakpoint(read()));
    };

    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return breakpoint;
}
