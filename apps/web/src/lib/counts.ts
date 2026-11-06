import { CARD_VALUES, type CardValue, type PlayerView } from '@loveletter/engine';
import { CARD_BY_VALUE } from './cards';

export interface CardCount {
  /** Copias en el mazo de 21 cartas. */
  total: number;
  /** Copias a la vista en la ronda actual: descartes de todos, tu mano y las boca arriba. */
  seen: number;
  /** total − seen: pueden estar en el mazo, en la carta apartada o en manos ajenas. */
  left: number;
}

export type CardCounts = Record<CardValue, CardCount>;

/**
 * Cuántas copias de cada carta quedan por aparecer, solo con lo que tu vista deja saber.
 * Cuenta la ronda actual: `discards` se reinicia en cada ronda y ya incluye la mano que un
 * eliminado enseña al caer (su `handSize` es 0, así que no se cuenta dos veces). Los resúmenes
 * de rondas anteriores y los sucesos secretos no intervienen.
 */
export function cardCounts(
  view: Pick<PlayerView, 'players' | 'faceUp'> & { you: Pick<PlayerView['you'], 'hand'> },
): CardCounts {
  const seen = Object.fromEntries(CARD_VALUES.map((v) => [v, 0])) as Record<CardValue, number>;
  for (const p of view.players) for (const c of p.discards) seen[c] += 1;
  for (const c of view.you.hand) seen[c] += 1;
  for (const c of view.faceUp) seen[c] += 1;
  return Object.fromEntries(
    CARD_VALUES.map((v) => {
      const total = CARD_BY_VALUE[v].copies;
      return [v, { total, seen: seen[v], left: Math.max(0, total - seen[v]) }];
    }),
  ) as CardCounts;
}
