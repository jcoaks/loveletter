import { chancellorChoice, legalPlays, seatOf } from './game';
import type { CardValue } from './rules';
import type {
  ChancellorChoice,
  GameEvent,
  GameState,
  LegalPlay,
  Phase,
  PlayerId,
  RoundSummary,
} from './types';

/** What everybody may know about a seat. */
export interface PublicPlayer {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
  tokens: number;
  /** Number of cards in hand (their identity is hidden). 0 when eliminated. */
  handSize: number;
  /** Face-up discards in the order they were played (includes the hand of an eliminated player). */
  discards: CardValue[];
  protected: boolean;
  eliminated: boolean;
  /** Played or discarded a Spy this round. */
  spyPlayed: boolean;
  isActive: boolean;
}

export interface RoundOverView {
  /** Players who already confirmed `continue_round` (bots are confirmed from the start). */
  ready: PlayerId[];
  /** Players the table is waiting for. */
  waitingFor: PlayerId[];
  youReady: boolean;
}

/**
 * Everything one player may see. Never contains other hands, the deck order or the set-aside card.
 * See packages/engine/README.md for how the UI should use it.
 */
export interface PlayerView {
  you: {
    id: PlayerId;
    name: string;
    seat: number;
    /** Your hand (2 cards on your turn, 3 or 2 in the Chancellor step). Empty if eliminated. */
    hand: CardValue[];
    eliminated: boolean;
    protected: boolean;
    tokens: number;
  };
  /** All seats in order, yourself included. */
  players: PublicPlayer[];
  phase: Phase;
  round: number;
  tokensToWin: number;
  activeId: PlayerId | null;
  /** You must `play_card` or `chancellor_keep` now. */
  isMyTurn: boolean;
  /** Whom the table is waiting on (active player, or humans yet to continue). */
  awaiting: PlayerId[];
  /** Only in phase `turn` on your turn: one entry per distinct card in hand. Otherwise `[]`. */
  legalPlays: LegalPlay[];
  /** Only in phase `chancellor` for the active player. */
  chancellor: ChancellorChoice | null;
  deckSize: number;
  /** Whether a face-down card is still set aside (its identity is never sent). */
  hasSetAside: boolean;
  /** Face-up removed cards (2-player games). */
  faceUp: CardValue[];
  /** Chronicle of the whole game; private details only on the events addressed to you. */
  events: GameEvent[];
  /** Summary of the round that just ended (phases `round_over` and `game_over`). */
  summary: RoundSummary | null;
  roundOver: RoundOverView | null;
  /** Summaries of all finished rounds. */
  history: RoundSummary[];
  winnerIds: PlayerId[];
}

/** Drops the private part of events not addressed to `playerId`. */
function visibleEvent(event: GameEvent, playerId: PlayerId): GameEvent {
  if (!event.secret || event.secret.to.includes(playerId)) return event;
  const { secret: _secret, ...rest } = event;
  return rest as GameEvent;
}

export function viewFor(state: GameState, playerId: PlayerId): PlayerView {
  const seat = seatOf(state, playerId);
  const me = state.players[seat];
  if (!me) throw new RangeError(`Jugador desconocido: ${playerId}`);

  const myTurn =
    state.activeId === playerId && (state.phase === 'turn' || state.phase === 'chancellor');
  const waitingFor =
    state.phase === 'round_over'
      ? state.players.map((p) => p.id).filter((id) => !state.ready.includes(id))
      : [];

  return {
    you: {
      id: playerId,
      name: me.name,
      seat,
      hand: [...(state.hands[playerId] ?? [])],
      eliminated: state.eliminated.includes(playerId),
      protected: state.protectedIds.includes(playerId),
      tokens: state.tokens[playerId] ?? 0,
    },
    players: state.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      seat: i,
      bot: p.bot === true,
      tokens: state.tokens[p.id] ?? 0,
      handSize: state.hands[p.id]?.length ?? 0,
      discards: [...(state.discards[p.id] ?? [])],
      protected: state.protectedIds.includes(p.id),
      eliminated: state.eliminated.includes(p.id),
      spyPlayed: state.spyPlayed.includes(p.id),
      isActive: state.activeId === p.id,
    })),
    phase: state.phase,
    round: state.round,
    tokensToWin: state.tokensToWin,
    activeId: state.activeId,
    isMyTurn: myTurn,
    awaiting: state.activeId ? [state.activeId] : waitingFor,
    legalPlays: state.phase === 'turn' && myTurn ? legalPlays(state, playerId) : [],
    chancellor: chancellorChoice(state, playerId),
    deckSize: state.deck.length,
    hasSetAside: state.setAside !== null,
    faceUp: [...state.faceUp],
    events: state.events.map((e) => visibleEvent(e, playerId)),
    summary: state.summary,
    roundOver:
      state.phase === 'round_over'
        ? { ready: [...state.ready], waitingFor, youReady: state.ready.includes(playerId) }
        : null,
    history: state.history,
    winnerIds: [...state.winnerIds],
  };
}
