import {
  type Action,
  applyAction,
  type CardValue,
  createGame,
  type GameState,
  seededRandom,
  viewFor,
} from '@loveletter/engine';
import type { RoomPlayer, RoomView } from '@loveletter/protocol';
import { useRoomStore } from './store/room';

const NAMES = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede'];

export interface Rig {
  /** Mano por asiento; el asiento activo tiene 2 cartas. Vacía = eliminado. */
  hands: CardValue[][];
  deck?: CardValue[];
  active?: number;
  protect?: number[];
  tokens?: number[];
  discards?: Record<number, CardValue[]>;
  bots?: number;
}

/** Partida en una posición hecha a mano, creada con el motor real. */
export function rig(o: Rig): GameState {
  const n = o.hands.length;
  const players = NAMES.slice(0, n).map((name, i) => ({
    id: `p${i}`,
    name,
    ...(i >= n - (o.bots ?? 0) ? { bot: true } : {}),
  }));
  const created = createGame({ players, starterId: 'p0' }, seededRandom(1));
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
  s.setAside = 4;
  s.faceUp = [];
  s.activeId = `p${o.active ?? 0}`;
  s.phase = 'turn';
  s.protectedIds = (o.protect ?? []).map((i) => `p${i}`);
  s.spyPlayed = [];
  s.events = [];
  return s;
}

export function step(state: GameState, ...actions: Action[]): GameState {
  let next = state;
  for (const action of actions) {
    const result = applyAction(next, action, seededRandom(3));
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    next = result.value;
  }
  return next;
}

export function roomFor(
  state: GameState,
  viewerId: string,
  extra: Partial<RoomView> = {},
): RoomView {
  return {
    code: 'KX7QM2',
    status: state.phase === 'game_over' ? 'finished' : 'playing',
    you: { id: viewerId, isHost: viewerId === 'p0' },
    hostId: 'p0',
    players: state.players.map(
      (p, i): RoomPlayer => ({
        id: p.id,
        name: p.name,
        ready: true,
        connected: true,
        left: false,
        bot: p.bot === true,
        host: i === 0,
      }),
    ),
    config: { bots: state.players.filter((p) => p.bot).length },
    limits: { minPlayers: 2, maxPlayers: 6 },
    canStart: false,
    game: viewFor(state, viewerId),
    chat: [],
    pause: null,
    ...extra,
  };
}

/** Pone la vista de `viewerId` en el store, conectado. */
export function seed(
  state: GameState,
  viewerId: string,
  fns: { act?: (a: unknown) => boolean; send?: (m: unknown) => boolean } = {},
  extra: Partial<RoomView> = {},
) {
  useRoomStore.setState({
    code: 'KX7QM2',
    playerId: viewerId,
    status: 'open',
    room: roomFor(state, viewerId, extra),
    act: (fns.act ?? (() => true)) as never,
    send: (fns.send ?? (() => true)) as never,
  });
}
