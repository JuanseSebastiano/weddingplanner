/**
 * Tokens del sistema de diseño y adaptación de color al fondo activo.
 *
 * La app soporta dos modos, oscuro (default) y claro. Las superficies y el
 * texto viven como variables CSS (ver index.css) que cambian con
 * `data-theme` en <html> — estos valores son referencias a esas variables,
 * no colores fijos, así que siguen el tema activo sin necesitar un
 * re-render de React. Lo único que sí necesita saber en qué tema está es el
 * cálculo de contraste de los colores de rubro, porque ahí no alcanza con
 * CSS: hay que recalcular la luminosidad según el fondo real.
 */

export const COLORS = {
  /** Fondo de la página. */
  bg: 'rgb(var(--nf-bg))',
  /** Barra lateral. */
  sidebar: 'rgb(var(--nf-sidebar))',
  /** Superficie de tarjeta. */
  card: 'rgb(var(--nf-card))',
  /** Superficie hundida: cabeceras de tabla, filas internas, inputs. */
  sunken: 'rgb(var(--nf-sunken))',
  input: 'rgb(var(--nf-input))',
  /** Superficie elevada: botones secundarios. */
  raised: 'rgb(var(--nf-raised))',

  textPrimary: 'rgb(var(--nf-ink-primary))',
  textStrong: 'rgb(var(--nf-ink-strong))',
  textBright: 'rgb(var(--nf-ink-bright))',
  textSoft: 'rgb(var(--nf-ink-soft))',
  textSecondary: 'rgb(var(--nf-ink-secondary))',
  textMuted: 'rgb(var(--nf-ink-muted))',
  textFaint: 'rgb(var(--nf-ink-faint))',

  /** Acento principal: la persona A y todas las acciones afirmativas. */
  accent: 'rgb(var(--nf-accent))',
  accentSoft: 'rgb(var(--nf-accent-soft))',
  accentDeep: 'rgb(var(--nf-accent-deep))',
  /** Texto sobre el acento. */
  onAccent: 'rgb(var(--nf-accent-on))',

  /** Persona B. Se distingue del acento por tono Y por forma del marcador. */
  accentB: 'rgb(var(--nf-violet))',

  /** Reservado a "pendiente de confirmar". No se usa para nada más. */
  pending: 'rgb(var(--nf-pending))',
  danger: 'rgb(var(--nf-danger))',
  dangerStrong: 'rgb(var(--nf-danger-strong))',

  /** Rubro sin color propio. */
  swatchEmpty: 'rgb(var(--nf-swatch-empty))',
} as const;

/** Colores de las dos personas del hogar, por orden estable de miembro. */
export const MEMBER_COLORS = [COLORS.accent, COLORS.accentB, 'rgb(var(--nf-sky))'];

/** El marcador cambia de forma además de color: círculo, cuadrado, rombo. */
export const MEMBER_SHAPES = ['50%', '2px', '0'];

export type Theme = 'dark' | 'light';

// ---------------------------------------------------------------------
// Adaptación del color de rubro a la superficie activa
// ---------------------------------------------------------------------

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Ajusta la luminosidad de un color de rubro hasta un paso legible sobre la
 * superficie activa, conservando el tono.
 *
 * El color vive en la base (`categories.color`), lo elige el usuario y no
 * tiene por qué ser legible sobre ningún fondo en particular. En vez de
 * invertirlo o ignorarlo —que borraría la identidad del rubro— se conserva
 * el tono y se recalcula la luminosidad: hacia arriba (más claro) sobre el
 * fondo oscuro, hacia abajo (más oscuro) sobre el fondo claro.
 *
 * `alternate` aplica un segundo nivel de luminosidad. Alternándolo por
 * posición, dos rubros vecinos en la torta difieren también en claridad y
 * no solo en tono, que es lo que los mantiene distinguibles con daltonismo.
 */
export function liftCategoryColor(hex: string, alternate = false, theme: Theme = 'dark'): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 'rgb(var(--nf-ink-faint))';
  const [h, s] = hexToHsl(hex);
  const sat = Math.min(Math.max(s, 0.5), 0.82);
  const lightness = theme === 'light' ? (alternate ? 0.45 : 0.35) : alternate ? 0.58 : 0.7;
  return hslToHex(h, sat, lightness);
}

/** Color de rubro listo para pintar, con el alternado ya resuelto. */
export function categoryColor(hex: string | null | undefined, index = 0, theme: Theme = 'dark'): string {
  if (!hex) return 'rgb(var(--nf-ink-faint))';
  return liftCategoryColor(hex, index % 2 === 1, theme);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

/**
 * Ratio de contraste entre dos colores, para mostrarlo en Configuración.
 * Necesita hex reales (no `var(--...)`), así que quien la llama con un color
 * de superficie del tema debe resolverlo primero (`getComputedStyle`).
 */
export function contrastRatio(hex: string, background: string): number {
  const a = relativeLuminance(hex) + 0.05;
  const b = relativeLuminance(background) + 0.05;
  return a > b ? a / b : b / a;
}

/**
 * Hex real de la tarjeta para cada tema, para el cálculo de contraste en
 * Configuración — `contrastRatio` necesita un color resoluble, no
 * `rgb(var(--nf-card))`. Se mantiene en paralelo a la variable CSS de
 * `index.css`; si cambia una, cambia la otra.
 */
const CARD_HEX: Record<Theme, string> = {
  dark: '#12141A',
  light: '#FFFFFF',
};

export function cardHex(theme: Theme): string {
  return CARD_HEX[theme];
}

/** Retardo escalonado para la animación de entrada de una lista. */
export function stagger(index: number, step = 45, max = 12): string {
  return `${Math.min(index, max) * step}ms`;
}
