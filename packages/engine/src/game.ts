import { type Random, shuffle } from './random';
import {
  BARON,
  buildDeck,
  CARD_VALUES,
  type CardValue,
  CHANCELLOR,
  COUNTESS,
  canTargetSelf,
  GUARD,
  HANDMAID,
  isCardValue,
  KING,
  needsTarget,
  PRIEST,
  PRINCE,
  PRINCESS,
  SPY,
  tokensToWin,
} from './rules';
import {
  type Action,
  type ChancellorChoice,
  type EliminationCause,
  type EventBody,
  type EventSecret,
  fail,
  type GameState,
  type LegalPlay,
  ok,
  type Phase,
  type Player,
  type PlayerId,
  type Result,
  type RoundSummary,
} from './types';

// ---------------------------------------------------------------------------
// Queries

export function seatOf(state: GameState, playerId: PlayerId): number {
  return state.players.findIndex((p) => p.id === playerId);
}

export function isEliminated(state: GameState, playerId: PlayerId): boolean {
  return state.eliminated.includes(playerId);
}

export function survivors(state: GameState): PlayerId[] {
  return state.players.map((p) => p.id).filter((id) => !isEliminated(state, id));
}

/** The Countess must be played when the hand also holds the King or the Prince. */
export function countessForced(hand: readonly CardValue[]): boolean {
  return hand.includes(COUNTESS) && (hand.includes(KING) || hand.includes(PRINCE));
}

/** Players `card` may legally be aimed at when `playerId` plays it. */
export function legalTargets(state: GameState, playerId: PlayerId, card: CardValue): PlayerId[] {
  if (!needsTarget(card)) return [];
  return state.players
    .map((p) => p.id)
    .filter(
      (id) =>
        !isEliminated(state, id) &&
        !state.protectedIds.includes(id) &&
        (id !== playerId || canTargetSelf(card)),
    );
}

export const GUESSES: readonly CardValue[] = CARD_VALUES.filter((v) => v !== GUARD);

/** One entry per distinct value in the hand of `playerId`; `playable` is false off-turn. */
export function legalPlays(state: GameState, playerId: PlayerId): LegalPlay[] {
  const hand = state.hands[playerId] ?? [];
  const myTurn = state.phase === 'turn' && state.activeId === playerId;
  const forced = myTurn && countessForced(hand);
  return [...new Set(hand)].map((card) => {
    const blocked = forced && card !== COUNTESS;
    const targets = myTurn ? legalTargets(state, playerId, card) : [];
    const asks = needsTarget(card);
    return {
      card,
      playable: myTurn && !blocked,
      blockedBy: blocked ? 'countess' : null,
      targetRule: !asks ? 'none' : canTargetSelf(card) ? 'any' : 'other',
      targets,
      needsTarget: asks && targets.length > 0,
      needsGuess: card === GUARD && targets.length > 0,
      guesses: card === GUARD && targets.length > 0 ? [...GUESSES] : [],
    };
  });
}

export function chancellorChoice(state: GameState, playerId: PlayerId): ChancellorChoice | null {
  if (state.phase !== 'chancellor' || state.activeId !== playerId) return null;
  const hand = [...(state.hands[playerId] ?? [])];
  return { hand, keepOptions: [...new Set(hand)], returnCount: hand.length - 1 };
}

/** Number of cards anywhere: deck + set aside + face up + hands + discards. Always 21. */
export function countCards(state: GameState): number {
  const inHands = Object.values(state.hands).reduce((n, h) => n + h.length, 0);
  const inDiscards = Object.values(state.discards).reduce((n, d) => n + d.length, 0);
  return (
    state.deck.length +
    (state.setAside === null ? 0 : 1) +
    state.faceUp.length +
    inHands +
    inDiscards
  );
}

// ---------------------------------------------------------------------------
// Internals (all mutate the draft passed in)

function emit(state: GameState, body: EventBody, secret?: EventSecret): void {
  const id = state.events.length;
  state.events.push({ id, round: state.round, ...(secret ? { secret } : {}), ...body });
}

function sumOf(values: readonly CardValue[]): number {
  return values.reduce<number>((a, b) => a + b, 0);
}

function discard(state: GameState, playerId: PlayerId, card: CardValue): void {
  (state.discards[playerId] as CardValue[]).push(card);
  if (card === SPY && !state.spyPlayed.includes(playerId)) state.spyPlayed.push(playerId);
}

function removeFromHand(state: GameState, playerId: PlayerId, card: CardValue): void {
  const hand = state.hands[playerId] as CardValue[];
  hand.splice(hand.indexOf(card), 1);
}

function eliminate(
  state: GameState,
  playerId: PlayerId,
  card: CardValue,
  cause: EliminationCause,
  byId: PlayerId | null,
): void {
  const revealed = [...(state.hands[playerId] as CardValue[])];
  state.hands[playerId] = [];
  // A bust-out hand goes face up on the table (it never counts as a played Spy: the player is out).
  for (const c of revealed) (state.discards[playerId] as CardValue[]).push(c);
  state.eliminated.push(playerId);
  state.protectedIds = state.protectedIds.filter((id) => id !== playerId);
  emit(state, { type: 'eliminated', playerId, card, revealed, cause, byId });
}

function drawFor(state: GameState, playerId: PlayerId, reason: 'turn' | 'prince'): void {
  let from: 'deck' | 'set_aside' = 'deck';
  let card = state.deck.shift();
  if (card === undefined) {
    from = 'set_aside';
    card = state.setAside as CardValue;
    state.setAside = null;
  }
  (state.hands[playerId] as CardValue[]).push(card);
  emit(state, { type: 'draw', playerId, reason, from }, { to: [playerId], drawn: [card] });
}

function startTurn(state: GameState, playerId: PlayerId): void {
  state.protectedIds = state.protectedIds.filter((id) => id !== playerId);
  state.activeId = playerId;
  state.phase = 'turn';
  drawFor(state, playerId, 'turn');
}

/** Deals a new round. `starterId` plays first. */
export function startRound(state: GameState, random: Random, starterId: PlayerId): void {
  const deck = shuffle(buildDeck(), random);
  state.round += 1;
  state.setAside = deck.shift() as CardValue;
  state.originalSetAside = state.setAside;
  state.faceUp = state.players.length === 2 ? deck.splice(0, 3) : [];
  state.hands = {};
  state.discards = {};
  for (const p of state.players) {
    state.hands[p.id] = [deck.shift() as CardValue];
    state.discards[p.id] = [];
  }
  state.deck = deck;
  state.protectedIds = [];
  state.eliminated = [];
  state.spyPlayed = [];
  state.ready = [];
  state.summary = null;
  state.nextStarterId = null;
  emit(state, { type: 'round_start', starterId, faceUp: [...state.faceUp] });
  startTurn(state, starterId);
}

function endTurn(state: GameState): void {
  const alive = survivors(state);
  if (alive.length <= 1 || state.deck.length === 0) {
    finishRound(state);
    return;
  }
  const n = state.players.length;
  let seat = seatOf(state, state.activeId as PlayerId);
  do {
    seat = (seat + 1) % n;
  } while (isEliminated(state, (state.players[seat] as Player).id));
  startTurn(state, (state.players[seat] as Player).id);
}

function finishRound(state: GameState): void {
  const alive = survivors(state);
  const last = alive.length === 1;
  let reason: RoundSummary['reason'] = 'last_standing';
  let winnerIds = alive;
  let discardTotals: Record<PlayerId, number> | null = null;

  if (!last) {
    const top = Math.max(...alive.map((id) => (state.hands[id] as CardValue[])[0] as CardValue));
    winnerIds = alive.filter((id) => (state.hands[id] as CardValue[])[0] === top);
    reason = 'highest_hand';
    if (winnerIds.length > 1) {
      discardTotals = Object.fromEntries(
        winnerIds.map((id) => [id, sumOf(state.discards[id] as CardValue[])]),
      );
      const best = Math.max(...Object.values(discardTotals));
      winnerIds = winnerIds.filter((id) => (discardTotals as Record<string, number>)[id] === best);
      reason = winnerIds.length > 1 ? 'shared_tie' : 'discard_tiebreak';
    }
  }

  const spies = alive.filter((id) => state.spyPlayed.includes(id));
  const spyBonusId = spies.length === 1 ? (spies[0] as PlayerId) : null;

  const awarded: Record<PlayerId, number> = {};
  for (const id of winnerIds) awarded[id] = (awarded[id] ?? 0) + 1;
  if (spyBonusId) awarded[spyBonusId] = (awarded[spyBonusId] ?? 0) + 1;
  for (const [id, n] of Object.entries(awarded)) state.tokens[id] = (state.tokens[id] ?? 0) + n;

  const goalReached = state.players
    .map((p) => p.id)
    .filter((id) => (state.tokens[id] ?? 0) >= state.tokensToWin);
  let gameWinnerIds: PlayerId[] | null = null;
  if (goalReached.length > 0) {
    const most = Math.max(...goalReached.map((id) => state.tokens[id] as number));
    gameWinnerIds = goalReached.filter((id) => state.tokens[id] === most);
  }

  const summary: RoundSummary = {
    round: state.round,
    reason,
    winnerIds,
    spyBonusId,
    survivors: alive,
    eliminated: [...state.eliminated],
    revealedHands: last
      ? null
      : Object.fromEntries(
          alive.map((id) => [id, (state.hands[id] as CardValue[])[0] as CardValue]),
        ),
    discardTotals,
    setAside: state.originalSetAside,
    awarded,
    tokens: { ...state.tokens },
    gameWinnerIds,
  };
  state.summary = summary;
  state.history.push(summary);
  state.activeId = null;
  state.nextStarterId =
    state.players.find((p) => winnerIds.includes(p.id))?.id ?? (state.players[0] as Player).id;
  emit(state, { type: 'round_end', summary });
  if (gameWinnerIds) {
    state.phase = 'game_over';
    state.winnerIds = gameWinnerIds;
    emit(state, { type: 'game_end', winnerIds: gameWinnerIds });
  } else {
    state.phase = 'round_over';
    state.ready = state.players.filter((p) => p.bot).map((p) => p.id);
  }
}

// ---------------------------------------------------------------------------
// Public API

/**
 * Applies one player action. Pure: returns a new state and never mutates the input.
 * `random` is only used when a new round is dealt (`continue_round`).
 */
export function applyAction(state: GameState, action: Action, random: Random): Result<GameState> {
  if (state.phase === 'game_over') return fail('game_over', 'La partida ha terminado');
  if (seatOf(state, action.playerId) < 0) return fail('unknown_player', 'Jugador desconocido');

  const next = structuredClone(state);
  switch (action.type) {
    case 'play_card':
      return playCard(next, action);
    case 'chancellor_keep':
      return chancellorKeep(next, action);
    case 'continue_round':
      return continueRound(next, action.playerId, random);
  }
}

function checkTurn(state: GameState, playerId: PlayerId, phase: Phase): Result<null> {
  if (state.phase !== phase) return fail('wrong_phase', 'No es momento de hacer eso');
  if (state.activeId !== playerId) return fail('not_your_turn', 'No es tu turno');
  return ok(null);
}

function playCard(
  state: GameState,
  action: Extract<Action, { type: 'play_card' }>,
): Result<GameState> {
  const { playerId, card } = action;
  const turn = checkTurn(state, playerId, 'turn');
  if (!turn.ok) return turn;
  const hand = state.hands[playerId] as CardValue[];
  if (!isCardValue(card) || !hand.includes(card)) {
    return fail('card_not_in_hand', 'No tienes esa carta en la mano');
  }
  const forced = countessForced(hand);
  if (forced && card !== COUNTESS) {
    return fail('countess_forced', 'Con el Rey o el Príncipe en la mano debes jugar la Condesa');
  }

  // Validate the target and the guess before touching anything.
  const options = legalTargets(state, playerId, card);
  let targetId: PlayerId | null = null;
  let guess: CardValue | null = null;
  if (options.length > 0) {
    const asked = action.targetId;
    if (asked === undefined) return fail('invalid_target', 'Debes elegir un jugador');
    if (seatOf(state, asked) < 0 || isEliminated(state, asked)) {
      return fail('invalid_target', 'Ese jugador no está en juego');
    }
    if (asked === playerId && !canTargetSelf(card)) {
      return fail('invalid_target', 'No puedes elegirte a ti mismo con esta carta');
    }
    if (state.protectedIds.includes(asked)) {
      return fail('target_protected', 'Ese jugador está protegido por la Doncella');
    }
    targetId = asked;
    if (card === GUARD) {
      if (!isCardValue(action.guess) || action.guess === GUARD) {
        return fail('invalid_guess', 'Nombra una carta distinta del Guardia');
      }
      guess = action.guess;
    }
  }

  removeFromHand(state, playerId, card);
  discard(state, playerId, card);
  emit(
    state,
    { type: 'play', playerId, card },
    forced ? { to: [playerId], forced: true } : undefined,
  );

  if (needsTarget(card) && targetId === null) {
    emit(state, { type: 'no_effect', playerId, card, reason: 'no_targets' });
    endTurn(state);
    return ok(state);
  }

  switch (card) {
    case SPY:
    case COUNTESS:
      emit(state, { type: 'no_effect', playerId, card, reason: 'card' });
      break;
    case GUARD: {
      const target = targetId as PlayerId;
      const hit = (state.hands[target] as CardValue[])[0] === guess;
      emit(state, {
        type: 'guess',
        playerId,
        targetId: target,
        guess: guess as CardValue,
        correct: hit,
      });
      if (hit) eliminate(state, target, guess as CardValue, 'guard', playerId);
      break;
    }
    case PRIEST: {
      const target = targetId as PlayerId;
      const seen = (state.hands[target] as CardValue[])[0] as CardValue;
      emit(
        state,
        { type: 'priest', playerId, targetId: target },
        { to: [playerId], hands: { [target]: seen } },
      );
      break;
    }
    case BARON: {
      const target = targetId as PlayerId;
      const mine = (state.hands[playerId] as CardValue[])[0] as CardValue;
      const theirs = (state.hands[target] as CardValue[])[0] as CardValue;
      const loserId = mine < theirs ? playerId : theirs < mine ? target : null;
      const loserCard = loserId === playerId ? mine : loserId === target ? theirs : null;
      emit(
        state,
        { type: 'baron', playerId, targetId: target, loserId, loserCard },
        { to: [playerId, target], hands: { [playerId]: mine, [target]: theirs } },
      );
      if (loserId)
        eliminate(
          state,
          loserId,
          loserCard as CardValue,
          'baron',
          loserId === playerId ? target : playerId,
        );
      break;
    }
    case HANDMAID:
      if (!state.protectedIds.includes(playerId)) state.protectedIds.push(playerId);
      emit(state, { type: 'protected', playerId });
      break;
    case PRINCE: {
      const target = targetId as PlayerId;
      const dropped = (state.hands[target] as CardValue[]).shift() as CardValue;
      discard(state, target, dropped);
      emit(state, { type: 'prince', playerId, targetId: target, discarded: dropped });
      if (dropped === PRINCESS) eliminate(state, target, PRINCESS, 'prince_princess', playerId);
      else drawFor(state, target, 'prince');
      break;
    }
    case CHANCELLOR: {
      const count = Math.min(2, state.deck.length);
      if (count === 0) {
        emit(state, { type: 'no_effect', playerId, card, reason: 'empty_deck' });
        break;
      }
      const drawn = state.deck.splice(0, count);
      hand.push(...drawn);
      state.phase = 'chancellor';
      emit(state, { type: 'chancellor', playerId, drawn: count }, { to: [playerId], drawn });
      return ok(state);
    }
    case KING: {
      const target = targetId as PlayerId;
      const mine = state.hands[playerId] as CardValue[];
      state.hands[playerId] = state.hands[target] as CardValue[];
      state.hands[target] = mine;
      emit(
        state,
        { type: 'king', playerId, targetId: target },
        {
          to: [playerId, target],
          hands: {
            [playerId]: (state.hands[playerId] as CardValue[])[0] as CardValue,
            [target]: (state.hands[target] as CardValue[])[0] as CardValue,
          },
        },
      );
      break;
    }
    case PRINCESS:
      eliminate(state, playerId, PRINCESS, 'played_princess', null);
      break;
  }
  endTurn(state);
  return ok(state);
}

function chancellorKeep(
  state: GameState,
  action: Extract<Action, { type: 'chancellor_keep' }>,
): Result<GameState> {
  const { playerId, keep, bottomOrder } = action;
  const turn = checkTurn(state, playerId, 'chancellor');
  if (!turn.ok) return turn;
  const hand = [...(state.hands[playerId] as CardValue[])];
  const at = hand.indexOf(keep);
  if (at < 0)
    return fail('invalid_chancellor_choice', 'No puedes conservar una carta que no tienes');
  hand.splice(at, 1);
  const sorted = (cards: readonly CardValue[]) => [...cards].sort((a, b) => a - b).join();
  if (
    !Array.isArray(bottomOrder) ||
    bottomOrder.length !== hand.length ||
    sorted(bottomOrder) !== sorted(hand)
  ) {
    return fail(
      'invalid_chancellor_choice',
      'Debes poner al fondo, en el orden que quieras, exactamente las demás cartas',
    );
  }
  state.hands[playerId] = [keep];
  state.deck.push(...bottomOrder);
  emit(state, { type: 'chancellor_done', playerId, returned: bottomOrder.length });
  endTurn(state);
  return ok(state);
}

function continueRound(state: GameState, playerId: PlayerId, random: Random): Result<GameState> {
  if (state.phase !== 'round_over')
    return fail('wrong_phase', 'No hay ninguna ronda por confirmar');
  if (!state.ready.includes(playerId)) state.ready.push(playerId);
  if (state.players.every((p) => state.ready.includes(p.id))) {
    startRound(state, random, state.nextStarterId as PlayerId);
  }
  return ok(state);
}

export { tokensToWin };
