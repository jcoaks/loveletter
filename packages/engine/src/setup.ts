import { startRound } from './game';
import type { Random } from './random';
import { randomInt } from './random';
import { MAX_PLAYERS, MIN_PLAYERS, tokensToWin } from './rules';
import { fail, type GameState, ok, type Player, type Result } from './types';

export interface GameOptions {
  /** In seat order. */
  players: Player[];
  /** Who opens round 1; random when omitted (tests). */
  starterId?: string;
}

/** Creates a game and deals round 1. All randomness (shuffle, first player) comes from `random`. */
export function createGame(options: GameOptions, random: Random): Result<GameState> {
  const { players } = options;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    return fail(
      'invalid_player_count',
      `Love Letter se juega con ${MIN_PLAYERS} a ${MAX_PLAYERS} jugadores`,
    );
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    return fail('duplicate_player', 'Hay jugadores repetidos');
  }
  const starter = options.starterId ?? (players[randomInt(random, players.length)] as Player).id;
  if (!players.some((p) => p.id === starter)) {
    return fail('unknown_player', 'El jugador inicial no está en la mesa');
  }

  const state: GameState = {
    players: players.map((p) => ({ ...p })),
    tokensToWin: tokensToWin(players.length),
    tokens: Object.fromEntries(players.map((p) => [p.id, 0])),
    round: 0,
    phase: 'turn',
    activeId: null,
    deck: [],
    setAside: null,
    faceUp: [],
    hands: {},
    discards: {},
    protectedIds: [],
    eliminated: [],
    spyPlayed: [],
    ready: [],
    summary: null,
    history: [],
    nextStarterId: null,
    winnerIds: [],
    events: [],
  };
  startRound(state, random, starter);
  return ok(state);
}
