import { describe, expect, it } from 'vitest';
import { contrast, hex, over } from './contrast';

// Colores de styles.css (tokens y valores de la portada y de la sala de espera).
const WINE = hex('#2b0e1b');
const WINE2 = hex('#4a1a31');
const IVORY = hex('#f2e6e3');
const INK = hex('#4a1126');
const BLACKISH = hex('#1a0a10');
const GOLD_LIGHT = hex('#f0d594');
const ROSE = hex('#d98a98');
const WAX = hex('#c23049');
const PARCH_LIGHT = hex('#f6e6b8');
const PARCH_DARK = hex('#e6c98a');
const BLACK = hex('#000000');
const WHITE = hex('#ffffff');

/** [descripción, texto, fondo]: todos deben cumplir AA para texto normal (≥ 4.5). */
const PAIRS: ReadonlyArray<[string, ReturnType<typeof hex>, ReturnType<typeof hex>]> = [
  // Portada: enlaces de la cabecera (píldora de pergamino, también la peor mezcla sobre fondo oscuro)
  ['enlace de la cabecera', BLACKISH, over(PARCH_LIGHT, 0.96, WINE)],
  ['enlace de la cabecera (hover)', BLACK, hex('#fff3cf')],
  // Portada: tarjeta de pergamino (peor extremo del degradado)
  ['texto de la tarjeta', INK, PARCH_DARK],
  ['etiquetas de la tarjeta', over(INK, 0.92, PARCH_DARK), PARCH_DARK],
  ['nota de la tarjeta', over(INK, 0.92, PARCH_DARK), PARCH_DARK],
  ['separador "o"', over(INK, 0.85, PARCH_DARK), PARCH_DARK],
  [
    'marcador de posición',
    over(INK, 0.75, over(WHITE, 0.55, PARCH_DARK)),
    over(WHITE, 0.55, PARCH_DARK),
  ],
  ['texto del campo', INK, over(WHITE, 0.55, PARCH_DARK)],
  ['botón secundario', INK, PARCH_DARK],
  ['error en pergamino', hex('#8c1630'), PARCH_DARK],
  // Portada sobre el fondo vino
  ['enlace del pie', GOLD_LIGHT, WINE],
  ['créditos', over(IVORY, 0.78, WINE), WINE],
  ['párrafos de las secciones', over(IVORY, 0.82, WINE), WINE],
  ['subtítulo de sección', over(IVORY, 0.8, WINE), WINE],
  // Sala de espera
  ['código de sala', BLACKISH, over(WHITE, 0.45, PARCH_DARK)],
  ['etiqueta de la invitación', over(INK, 0.92, PARCH_DARK), PARCH_DARK],
  ['estado del jugador', over(IVORY, 0.8, WINE), over(BLACK, 0.28, WINE)],
  ['aviso de estado desconectado', ROSE, over(BLACK, 0.28, WINE)],
  ['hueco vacío', over(IVORY, 0.75, WINE), WINE],
  ['razón del botón de inicio', over(IVORY, 0.85, WINE), WINE],
  ['resumen de la mesa', over(IVORY, 0.88, WINE), over(BLACK, 0.3, WINE)],
  ['enlace a las reglas', GOLD_LIGHT, over(BLACK, 0.3, WINE)],
  ['aviso de reconexión', hex('#ffd7de'), over(WAX, 0.18, WINE2)],
  ['"Jugar" sobre cera', WHITE, WAX],
  // Sistema de botones (styles.css): cada variante, sobre su peor fondo
  ['primario: marfil sobre cera', IVORY, WAX],
  ['secundario sobre vino', GOLD_LIGHT, over(WINE, 0.45, WINE2)],
  ['secundario sobre el fondo más claro de la mesa', GOLD_LIGHT, over(WINE, 0.45, hex('#5a1d38'))],
  ['peligro sobre vino', hex('#ffc2cc'), over(WINE, 0.45, WINE2)],
  ['secundario con vidrio sobre el arte más claro', GOLD_LIGHT, over(WINE, 0.82, PARCH_LIGHT)],
  ['secundario sobre pergamino', BLACKISH, over(WHITE, 0.35, PARCH_DARK)],
  ['peligro sobre pergamino', hex('#8c1630'), over(WHITE, 0.35, PARCH_DARK)],
];

describe('Contraste de texto (WCAG AA, ≥ 4.5:1)', () => {
  for (const [name, fg, bg] of PAIRS) {
    it(name, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('la función da los valores de referencia', () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 0);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5);
  });
});
