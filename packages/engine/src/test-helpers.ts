import { applyAction } from './game';
import { seededRandom } from './random';
import type { CardValue } from './rules';
import { createGame } from './setup';
import type { Action, ErrorCode, GameState, Player, PlayerId } from './types';

const NAMES = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede', 'Gala', 'Hugo'];

export function makePlayers(count: number, bots = 0): Player[] {
  return NAMES.slice(0, count).map((name, i) => ({
    id: `p${i}`,
    name,
    ...(i >= count - bots ? { bot: true } : {}),
  }));
}

export interface Rig {
  /** Hand per seat; the active seat has 2 cards. Empty array = eliminated. */
  hands: CardValue[][];
  deck?: CardValue[];
  setAside?: CardValue | null;
  active?: number;
  discards?: Record<number, CardValue[]>;
  protect?: number[];
  tokens?: number[];
  spy?: number[];
  faceUp?: CardValue[];
  bots?: number;
}

/** A game in a hand-made position (not necessarily 21 cards in total). */
export function rig(o: Rig): GameState {
  const n = o.hands.length;
  const created = createGame(
    { players: makePlayers(n, o.bots ?? 0), starterId: 'p0' },
    seededRandom(1),
  );
  if (!created.ok) throw new Error(created.error.message);
  const s = created.value;
  s.hands = {};
  s.discards = {};
  s.eliminated = [];
  o.hands.forEach((hand, i) => {
    s.hands[`p${i}`] = [...hand];
    s.discards[`p${i}`] = [...(o.discards?.[i] ?? [])];
    if (hand.length === 0) s.eliminated.push(`p${i}`);
    if (o.tokens?.[i] !== undefined) s.tokens[`p${i}`] = o.tokens[i] as number;
  });
  s.deck = [...(o.deck ?? [1, 1, 1, 2, 2, 3])];
  s.setAside = o.setAside === undefined ? 4 : o.setAside;
  s.faceUp = o.faceUp ?? [];
  s.activeId = `p${o.active ?? 0}`;
  s.phase = 'turn';
  s.protectedIds = (o.protect ?? []).map((i) => `p${i}`);
  s.spyPlayed = (o.spy ?? []).map((i) => `p${i}`);
  s.events = [];
  return s;
}

const rng = seededRandom(7);

export function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action, rng);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

export function errorOf(state: GameState, action: Action): ErrorCode | null {
  const result = applyAction(state, action, rng);
  return result.ok ? null : result.error.code;
}

export const play = (
  _state: GameState,
  playerId: PlayerId,
  card: CardValue,
  targetId?: PlayerId,
  guess?: CardValue,
): Action => ({
  type: 'play_card',
  playerId,
  card,
  ...(targetId !== undefined ? { targetId } : {}),
  ...(guess !== undefined ? { guess } : {}),
});

export function eventsOf(state: GameState, type: string) {
  return state.events.filter((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// Simulation helpers

import { chooseBotAction, createBotNotes } from './bot';
import { type Random, randomInt, shuffle } from './random';
import { viewFor } from './view';

export type Policy = 'bot' | 'random';

/** Whoever has to act next (null when the game is over). */
export function nextActor(state: GameState): PlayerId | null {
  if (state.phase === 'game_over') return null;
  if (state.phase === 'round_over') {
    return state.players.find((p) => !state.ready.includes(p.id))?.id ?? null;
  }
  return state.activeId;
}

/** A random but legal move for `playerId`, built only from their view. */
export function randomAction(state: GameState, playerId: PlayerId, random: Random): Action {
  const view = viewFor(state, playerId);
  if (view.phase === 'round_over') return { type: 'continue_round', playerId };
  if (view.chancellor) {
    const hand = view.chancellor.hand;
    const keepCard = hand[randomInt(random, hand.length)] as CardValue;
    const rest = [...hand];
    rest.splice(rest.indexOf(keepCard), 1);
    return {
      type: 'chancellor_keep',
      playerId,
      keep: keepCard,
      bottomOrder: shuffle(rest, random),
    };
  }
  const options = view.legalPlays.filter((p) => p.playable);
  const choice = options[randomInt(random, options.length)];
  if (!choice) throw new Error('Sin jugadas legales');
  return {
    type: 'play_card',
    playerId,
    card: choice.card,
    ...(choice.needsTarget
      ? { targetId: choice.targets[randomInt(random, choice.targets.length)] as PlayerId }
      : {}),
    ...(choice.needsGuess
      ? { guess: choice.guesses[randomInt(random, choice.guesses.length)] as CardValue }
      : {}),
  };
}

export function botAction(state: GameState, playerId: PlayerId, random: Random): Action {
  const chosen = chooseBotAction(viewFor(state, playerId), createBotNotes(random), random);
  if (!chosen) throw new Error(`El bot ${playerId} no encontró acción en la fase ${state.phase}`);
  return chosen.action;
}

/**
 * Plays a whole game. `onStep(before, action, after)` is called after every action.
 * Throws if an action is rejected or the game does not end within `maxSteps`.
 */
export function simulate(
  playerCount: number,
  seed: number,
  policy: Policy,
  onStep?: (before: GameState, action: Action, after: GameState) => void,
  maxSteps = 20000,
): GameState {
  const random = seededRandom(seed * 7919 + 13);
  const created = createGame({ players: makePlayers(playerCount, seed % 3 === 0 ? 1 : 0) }, random);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.value;
  for (let step = 0; step < maxSteps; step++) {
    const actor = nextActor(state);
    if (actor === null) return state;
    const action =
      policy === 'bot' ? botAction(state, actor, random) : randomAction(state, actor, random);
    const result = applyAction(state, action, random);
    if (!result.ok) {
      throw new Error(`Acción rechazada (${result.error.code}): ${JSON.stringify(action)}`);
    }
    onStep?.(state, action, result.value);
    state = result.value;
  }
  throw new Error(`La partida ${seed} no terminó`);
}
