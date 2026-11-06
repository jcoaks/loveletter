import {
  CARD_VALUES,
  type CardId,
  type CardValue,
  cards,
  GUESSES,
  rules,
  tokensToWin,
} from '@loveletter/engine';

/**
 * Tabla de cartas para la interfaz. La fuente de verdad es el motor (`config/loveletter-rules.json`):
 * valor, id, nombre, copias y texto vienen de él. Aquí solo se añade lo que es propio de la
 * pantalla: el texto breve del cartucho y el artículo del nombre.
 */
export type { CardId, CardValue };

export interface CardDef {
  value: CardValue;
  id: CardId;
  name: string;
  copies: number;
  /** Texto breve para el cartucho de la carta. */
  short: string;
  /** Efecto completo (reglas). */
  text: string;
  /** Artículo definido del nombre ("el Guardia", "la Doncella"). */
  article: 'el' | 'la';
}

const UI: Record<CardValue, { short: string; article: 'el' | 'la' }> = {
  0: { short: 'Sin efecto. Puede darte una ficha.', article: 'el' },
  1: { short: 'Adivina la carta de otro jugador.', article: 'el' },
  2: { short: 'Mira la mano de otro.', article: 'el' },
  3: { short: 'Compara manos. La más baja sale.', article: 'el' },
  4: { short: 'Nadie puede elegirte hasta tu turno.', article: 'la' },
  5: { short: 'Alguien descarta y roba carta.', article: 'el' },
  6: { short: 'Roba 2, conserva 1, 2 al fondo.', article: 'el' },
  7: { short: 'Cambia tu mano con la de otro.', article: 'el' },
  8: { short: 'Obligatoria si tienes Rey o Príncipe.', article: 'la' },
  9: { short: 'Si la descartas, sales.', article: 'la' },
};

export const CARDS: readonly CardDef[] = CARD_VALUES.map((value) => {
  const c = cards[value];
  return { ...c, ...UI[value] };
});

export const CARD_BY_VALUE = Object.fromEntries(CARDS.map((c) => [c.value, c])) as Record<
  CardValue,
  CardDef
>;

/** Valores con arte. Una carta sin arte (o cuya imagen falla) se dibuja con el diseño de respaldo. */
const WITH_ART: ReadonlySet<CardValue> = new Set<CardValue>(CARD_VALUES);

/** URL del arte (WebP): grande 378x529 para `lg`, pequeño 114x160 para `sm`. Carga bajo demanda. */
export const artUrl = (v: CardValue, size: 'lg' | 'sm'): string | undefined =>
  WITH_ART.has(v) ? `/assets/card-${v}${size === 'sm' ? '-sm' : ''}.webp` : undefined;

export const CARD_BACK_ART = '/assets/card-back-sm.webp';
export const TOKEN_ART = '/assets/token.webp';
export const LOGO_ART = '/assets/logo.webp';
export const BAG_ART = '/assets/bag.webp';

/** Cartas que se pueden nombrar con el Guardia (todas salvo el Guardia). */
export const GUESSABLE_VALUES: readonly CardValue[] = GUESSES;

/** Fichas de afecto necesarias para ganar, por número de jugadores (del motor). */
export const TOKENS_TO_WIN: Record<number, number> = Object.fromEntries(
  Object.keys(rules.tokensToWin).map((n) => [Number(n), tokensToWin(Number(n))]),
);

export const cardName = (v: CardValue): string => CARD_BY_VALUE[v].name;

/** "el Guardia", "la Doncella". */
export const withArticle = (v: CardValue): string => {
  const c = CARD_BY_VALUE[v];
  return `${c.article} ${c.name}`;
};

/** Con la Condesa en la mano no se puede jugar el Rey ni el Príncipe. */
export const isLockedByCountess = (hand: readonly CardValue[], v: CardValue): boolean =>
  (v === 5 || v === 7) && hand.includes(8);
