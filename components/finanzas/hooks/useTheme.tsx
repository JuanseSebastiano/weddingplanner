export type ThemeName = 'dark' | 'light';

/**
 * La app unificada tiene un solo modo (claro). Se conserva el hook porque
 * el cálculo de contraste de los colores de rubro lo consulta.
 */
export function useTheme(): { theme: ThemeName } {
  return { theme: 'light' };
}
