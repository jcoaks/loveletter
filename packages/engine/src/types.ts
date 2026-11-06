import type { CardValue } from './rules';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  /** Bots confirm `continue_round` on their own (they are pre-marked as ready). */
  bot?: boolean;
}

/**
 * - `turn`: the active player holds 2 cards and must `play_card`.
 * - `chancellor`: the active player played the Chancellor and must `chancellor_keep`.
 * - `round_over`: round summary on screen; every human must `continue_round`.
 * - `game_over`: someone reached the token goal. Terminal.
 */
export type Phase = 'turn' | 'chancellor' | 'round_over' | 'game_over';

export type EliminationCause = 'guard' | 'baron' | 'prince_princess' | 'played_princess';

/**
 * - `last_standing`: everyone else was eliminated.
 * - `highest_hand`: deck ran out; the highest hand among the survivors wins.
 * - `discard_tiebreak`: tied hands; the larger sum of discarded values wins.
 * - `shared_tie`: still tied; every tied player wins.
 */
export type RoundEndReason = 'last_standing' | 'highest_hand' | 'discard_tiebreak' | 'shared_tie';

export interface RoundSummary {
  round: number;
  reason: RoundEndReason;
  winnerIds: PlayerId[];
  /** The only surviving player who played or discarded a Spy: +1 token. */
  spyBonusId: PlayerId | null;
  survivors: PlayerId[];
  eliminated: PlayerId[];
  /** Final hands of the survivors. Only when the deck ran out; `null` for `last_standing`. */
  revealedHands: Record<PlayerId, CardValue> | null;
  /** Sum of discarded values per survivor. Only when it was compared (tied hands). */
  discardTotals: Record<PlayerId, number> | null;
  /** Tokens gained this round (winners and Spy bonus). */
  awarded: Record<PlayerId, number>;
  /** The card that was set aside face down this round (revealed only once the round is over). */
  setAside: CardValue;
  /** Token totals after this round. */
  tokens: Record<PlayerId, number>;
  /** Set when this round ended the game. */
  gameWinnerIds: PlayerId[] | null;
}

/** Private data attached to a chronicle event. `viewFor` only passes it to `to`. */
export interface EventSecret {
  to: PlayerId[];
  /** Cards drawn (draw, Chancellor). */
  drawn?: CardValue[];
  /**
   * Cards by owner. Priest: the target's card. Baron: both hands. King: what each side holds
   * AFTER the swap (each party sees the card it receives).
   */
  hands?: Record<PlayerId, CardValue>;
  /** `play` only: the Countess was forced by the King/Prince in hand (secret: it reveals the hand). */
  forced?: boolean;
}

export type EventBody =
  | { type: 'round_start'; starterId: PlayerId; faceUp: CardValue[] }
  | { type: 'draw'; playerId: PlayerId; reason: 'turn' | 'prince'; from: 'deck' | 'set_aside' }
  | { type: 'play'; playerId: PlayerId; card: CardValue }
  | {
      type: 'no_effect';
      playerId: PlayerId;
      card: CardValue;
      reason: 'card' | 'no_targets' | 'empty_deck';
    }
  | { type: 'protected'; playerId: PlayerId }
  | { type: 'guess'; playerId: PlayerId; targetId: PlayerId; guess: CardValue; correct: boolean }
  | { type: 'priest'; playerId: PlayerId; targetId: PlayerId }
  | {
      type: 'baron';
      playerId: PlayerId;
      targetId: PlayerId;
      loserId: PlayerId | null;
      loserCard: CardValue | null;
    }
  | { type: 'king'; playerId: PlayerId; targetId: PlayerId }
  | { type: 'prince'; playerId: PlayerId; targetId: PlayerId; discarded: CardValue }
  | { type: 'chancellor'; playerId: PlayerId; drawn: number }
  | { type: 'chancellor_done'; playerId: PlayerId; returned: number }
  | {
      type: 'eliminated';
      playerId: PlayerId;
      /** The decisive card (guessed, lost the Baron with, Princess). */
      card: CardValue;
      /** Cards moved from the hand to the discards, face up. */
      revealed: CardValue[];
      cause: EliminationCause;
      byId: PlayerId | null;
    }
  | { type: 'round_end'; summary: RoundSummary }
  | { type: 'game_end'; winnerIds: PlayerId[] };

/** One entry of the public chronicle. `id` grows by one per event across the whole game. */
export type GameEvent = { id: number; round: number; secret?: EventSecret } & EventBody;

/** Full authoritative state. JSON-serialisable. Never sent to clients: use `viewFor`. */
export interface GameState {
  /** In seat order: index = seat. */
  players: Player[];
  tokensToWin: number;
  tokens: Record<PlayerId, number>;
  /** 1-based number of the current (or last) round. */
  round: number;
  phase: Phase;
  /** Whose turn it is in `turn` / `chancellor`; null otherwise. */
  activeId: PlayerId | null;
  /** Draw pile. Index 0 is the top; the bottom is the end of the array. */
  deck: CardValue[];
  /** Face-down card set aside at the start of the round (null once a Prince drew it). */
  setAside: CardValue | null;
  /** The card set aside at the start of the round, kept even after a Prince draws it. Never in views. */
  originalSetAside: CardValue;
  /** Face-up removed cards (2 players only), visible to everyone. */
  faceUp: CardValue[];
  hands: Record<PlayerId, CardValue[]>;
  /** Discards per player, in the order they hit the table. */
  discards: Record<PlayerId, CardValue[]>;
  protectedIds: PlayerId[];
  eliminated: PlayerId[];
  /** Players who played or discarded a Spy this round. */
  spyPlayed: PlayerId[];
  /** Who has confirmed `continue_round` (bots are pre-confirmed). */
  ready: PlayerId[];
  /** Summary of the round that just ended (`round_over` / `game_over`). */
  summary: RoundSummary | null;
  history: RoundSummary[];
  /** Who opens the next round (lowest seat among the last round's winners). */
  nextStarterId: PlayerId | null;
  winnerIds: PlayerId[];
  events: GameEvent[];
}

export type Action =
  | {
      type: 'play_card';
      playerId: PlayerId;
      card: CardValue;
      targetId?: PlayerId;
      guess?: CardValue;
    }
  | { type: 'chancellor_keep'; playerId: PlayerId; keep: CardValue; bottomOrder: CardValue[] }
  | { type: 'continue_round'; playerId: PlayerId };

/** What the UI needs to build the play of one card in the hand. See README. */
export interface LegalPlay {
  card: CardValue;
  /** False when blocked (Countess rule) or when it is not your turn. */
  playable: boolean;
  blockedBy: 'countess' | null;
  /** 'none': play directly. 'other': pick someone else. 'any': pick anyone, yourself included. */
  targetRule: 'none' | 'other' | 'any';
  /** Legal targets. Empty with a targetRule other than 'none' means: play with no effect. */
  targets: PlayerId[];
  /** True when `targetId` must be sent (the card asks for a target and there are legal ones). */
  needsTarget: boolean;
  /** True when `guess` must be sent (Guard with a target). */
  needsGuess: boolean;
  /** Legal guesses (all values but 1; 0 counts). Empty unless `needsGuess`. */
  guesses: CardValue[];
}

/** The Chancellor decision: keep one of `hand`, return `returnCount` to the bottom in order. */
export interface ChancellorChoice {
  hand: CardValue[];
  keepOptions: CardValue[];
  returnCount: number;
}

export type ErrorCode =
  | 'invalid_player_count'
  | 'duplicate_player'
  | 'game_over'
  | 'wrong_phase'
  | 'unknown_player'
  | 'not_your_turn'
  | 'card_not_in_hand'
  | 'countess_forced'
  | 'invalid_target'
  | 'target_protected'
  | 'invalid_guess'
  | 'invalid_chancellor_choice';

export interface GameError {
  code: ErrorCode;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: GameError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}
