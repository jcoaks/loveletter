import raw from '../../../config/loveletter-rules.json';

/** Card values double as identities: 0 Espía … 9 Princesa. */
export type CardValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type CardId =
  | 'spy'
  | 'guard'
  | 'priest'
  | 'baron'
  | 'handmaid'
  | 'prince'
  | 'chancellor'
  | 'king'
  | 'countess'
  | 'princess';

export interface CardDef {
  value: CardValue;
  id: CardId;
  /** Spanish name shown to players. */
  name: string;
  copies: number;
  text: string;
}

export const CARD_VALUES: readonly CardValue[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The card table, straight from `config/loveletter-rules.json`. */
export const cards = Object.fromEntries(
  (raw.cards as CardDef[]).map((card) => [card.value, card]),
) as Record<CardValue, CardDef>;

export const rules = raw;

export const MIN_PLAYERS = raw.players.min;
export const MAX_PLAYERS = raw.players.max;
export const DECK_SIZE = CARD_VALUES.reduce<number>((sum, v) => sum + cards[v].copies, 0);

/** Card names by value: `cardNames[1] === 'Guardia'`. */
export const cardNames = Object.fromEntries(CARD_VALUES.map((v) => [v, cards[v].name])) as Record<
  CardValue,
  string
>;

/** Copies of each card in the deck by value. */
export const cardCopies = Object.fromEntries(
  CARD_VALUES.map((v) => [v, cards[v].copies]),
) as Record<CardValue, number>;

export const SPY: CardValue = 0;
export const GUARD: CardValue = 1;
export const PRIEST: CardValue = 2;
export const BARON: CardValue = 3;
export const HANDMAID: CardValue = 4;
export const PRINCE: CardValue = 5;
export const CHANCELLOR: CardValue = 6;
export const KING: CardValue = 7;
export const COUNTESS: CardValue = 8;
export const PRINCESS: CardValue = 9;

export function isCardValue(value: unknown): value is CardValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9;
}

/** Affection tokens needed to win the game with this many players. */
export function tokensToWin(playerCount: number): number {
  const goal = (raw.tokensToWin as Record<string, number>)[String(playerCount)];
  if (goal === undefined) throw new RangeError(`Número de jugadores no válido: ${playerCount}`);
  return goal;
}

/** The 21 cards, sorted by value (shuffle before use). */
export function buildDeck(): CardValue[] {
  return CARD_VALUES.flatMap((v) => Array<CardValue>(cards[v].copies).fill(v));
}

/** Cards that ask the player to choose someone. */
export function needsTarget(card: CardValue): boolean {
  return card === GUARD || card === PRIEST || card === BARON || card === PRINCE || card === KING;
}

/** Whether the effect may be aimed at the player themselves (only the Prince). */
export function canTargetSelf(card: CardValue): boolean {
  return card === PRINCE;
}
