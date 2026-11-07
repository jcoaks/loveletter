/** Contraste WCAG 2.x entre dos colores (para comprobar que los textos cumplen AA). */
export type RGB = readonly [number, number, number];

export function hex(value: string): RGB {
  const h = value.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla un color con transparencia `alpha` sobre un fondo opaco. */
export function over(fg: RGB, alpha: number, bg: RGB): RGB {
  return [0, 1, 2].map((i) =>
    Math.round((fg[i] ?? 0) * alpha + (bg[i] ?? 0) * (1 - alpha)),
  ) as unknown as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
