// Computer players. A bot decides only from its own PlayerView (plus its private notes), so it
// knows exactly what a person in its seat would know: its hand, what it saw with the Priest,
// Baron or King, and every card played so far (to count copies).
import type { Random } from './random';
import {
  BARON,
  CARD_VALUES,
  type CardValue,
  CHANCELLOR,
  COUNTESS,
  cardCopies,
  GUARD,
  HANDMAID,
  KING,
  PRIEST,
  PRINCE,
  PRINCESS,
  SPY,
} from './rules';
import type { Action, PlayerId } from './types';
import type { PlayerView } from './view';

/** What a bot keeps between calls. Everything else it needs it derives from the view. */
export interface BotNotes {
  /** 0..1: how much noise it adds to its choices (more = more adventurous). */
  risk: number;
}

export function emptyBotNotes(): BotNotes {
  return { risk: 0.5 };
}

export function createBotNotes(random: Random): BotNotes {
  return { risk: 0.2 + random() * 0.6 };
}

/**
 * Cards the bot knows are in an opponent's hand right now, replaying the chronicle of the
 * round: Priest peeks, Baron comparisons and King swaps it took part in, minus what has moved.
 */
export function knownHands(view: PlayerView): Map<PlayerId, CardValue> {
  const me = view.you.id;
  const known = new Map<PlayerId, CardValue>();
  for (const e of view.events) {
    if (e.round !== view.round) continue;
    switch (e.type) {
      case 'round_start':
        known.clear();
        break;
      case 'priest':
        if (e.secret?.hands && e.playerId === me) {
          const seen = e.secret.hands[e.targetId];
          if (seen !== undefined) known.set(e.targetId, seen);
        }
        break;
      case 'baron': {
        const other = e.playerId === me ? e.targetId : e.playerId;
        const seen = e.secret?.hands?.[other];
        if (seen !== undefined && e.loserId === null) known.set(other, seen);
        break;
      }
      case 'king': {
        const other = e.playerId === me ? e.targetId : e.playerId;
        if (e.playerId === me || e.targetId === me) {
          const seen = e.secret?.hands?.[other];
          if (seen !== undefined) known.set(other, seen);
        } else {
          const a = known.get(e.playerId);
          const b = known.get(e.targetId);
          known.delete(e.playerId);
          known.delete(e.targetId);
          if (a !== undefined) known.set(e.targetId, a);
          if (b !== undefined) known.set(e.playerId, b);
        }
        break;
      }
      case 'play':
        if (known.get(e.playerId) === e.card) known.delete(e.playerId);
        break;
      case 'prince':
        known.delete(e.targetId);
        break;
      case 'chancellor_done':
        known.delete(e.playerId);
        break;
      case 'eliminated':
        known.delete(e.playerId);
        break;
    }
  }
  for (const p of view.players) if (p.eliminated || p.id === me) known.delete(p.id);
  return known;
}

/** Copies of each card the bot has not seen yet (deck, set-aside card or opponents' hands). */
export function unseenCards(view: PlayerView): Record<CardValue, number> {
  const left = { ...cardCopies };
  const see = (card: CardValue) => {
    left[card] = Math.max(0, left[card] - 1);
  };
  for (const p of view.players) for (const c of p.discards) see(c);
  for (const c of view.faceUp) see(c);
  for (const c of view.you.hand) see(c);
  return left;
}

/** Odds for each card being in `targetId`'s hand, from what the bot knows. */
export function handOdds(
  view: PlayerView,
  targetId: PlayerId,
  known: Map<PlayerId, CardValue> = knownHands(view),
): Record<CardValue, number> {
  const odds = Object.fromEntries(CARD_VALUES.map((v) => [v, 0])) as Record<CardValue, number>;
  const sure = known.get(targetId);
  if (sure !== undefined) {
    odds[sure] = 1;
    return odds;
  }
  const pool = unseenCards(view);
  for (const [id, card] of known) if (id !== targetId) pool[card] = Math.max(0, pool[card] - 1);
  const total = CARD_VALUES.reduce<number>((n, v) => n + pool[v], 0);
  if (total === 0) return odds;
  for (const v of CARD_VALUES) odds[v] = pool[v] / total;
  return odds;
}

function keepValue(card: CardValue): number {
  return card === PRINCESS ? 7 : card * 0.6;
}

interface Option {
  card: CardValue;
  targetId?: PlayerId;
  guess?: CardValue;
  score: number;
}

/** The bot's move for this view, or null when it has nothing to do. */
export function chooseBotAction(
  view: PlayerView,
  notes: BotNotes,
  random: Random,
): { action: Action; notes: BotNotes } | null {
  const me = view.you.id;
  const done = (action: Action) => ({ action, notes });

  if (view.phase === 'game_over') return null;
  if (view.phase === 'round_over') {
    return view.roundOver && !view.roundOver.youReady
      ? done({ type: 'continue_round', playerId: me })
      : null;
  }
  if (!view.isMyTurn) return null;

  if (view.phase === 'chancellor' && view.chancellor) {
    const best = [...view.chancellor.hand].sort(
      (a, b) => keepValue(b) - keepValue(a),
    )[0] as CardValue;
    const rest = [...view.chancellor.hand];
    rest.splice(rest.indexOf(best), 1);
    // The order at the bottom is a coin toss: nobody can plan around it, the bot included.
    if (rest.length === 2 && random() < 0.5) rest.reverse();
    return done({ type: 'chancellor_keep', playerId: me, keep: best, bottomOrder: rest });
  }

  const known = knownHands(view);
  const others = view.players.filter((p) => p.id !== me && !p.eliminated);
  const leading = others.every((p) => p.tokens <= view.you.tokens);
  const mySpy = view.players.find((p) => p.id === me)?.spyPlayed === true;
  const spyOut = others.some((p) => p.spyPlayed);
  const tokensOf = (id: PlayerId) => view.players.find((p) => p.id === id)?.tokens ?? 0;
  const options: Option[] = [];

  for (const play of view.legalPlays) {
    if (!play.playable) continue;
    const keep = [...view.you.hand];
    keep.splice(keep.indexOf(play.card), 1);
    const k = keep[0] as CardValue;
    const base = keepValue(k) + random() * notes.risk * 1.5;
    const push = (score: number, targetId?: PlayerId, guess?: CardValue) =>
      options.push({ card: play.card, targetId, guess, score: score + base });

    if (play.card === PRINCESS) {
      push(-1000);
      continue;
    }
    if (!play.needsTarget) {
      switch (play.card) {
        case SPY:
          push(mySpy ? 1 : spyOut ? 0.5 : 4.5);
          break;
        case HANDMAID:
          push(4 + (leading ? 2 : 0) + (k >= 7 ? 3 : 0));
          break;
        case CHANCELLOR:
          push(view.deckSize > 0 ? 5 + (k <= 2 ? 2 : 0) : 1);
          break;
        case COUNTESS:
          push(1.5 + (k === PRINCESS ? 3 : 0));
          break;
        default:
          // Cards that ask for a target but have none: they just fizzle.
          push(0);
      }
      continue;
    }

    for (const t of play.targets) {
      const odds = handOdds(view, t, known);
      const sure = known.get(t);
      const tokenBias = tokensOf(t) * 0.3;
      switch (play.card) {
        case GUARD: {
          let guess: CardValue = 2;
          let p = -1;
          for (const g of play.guesses) {
            const gp = odds[g] + random() * 1e-6;
            if (gp > p) {
              p = gp;
              guess = g;
            }
          }
          push(
            (sure !== undefined && sure !== GUARD ? 60 : 14 * Math.max(p, 0)) + tokenBias,
            t,
            guess,
          );
          break;
        }
        case PRIEST:
          push((sure === undefined ? 3.5 : 0.5) + tokenBias, t);
          break;
        case BARON: {
          let win = 0;
          let lose = 0;
          for (const v of CARD_VALUES) {
            if (v < k) win += odds[v];
            else if (v > k) lose += odds[v];
          }
          push(28 * win - 40 * lose + 1 + tokenBias, t);
          break;
        }
        case PRINCE: {
          if (t === me) {
            if (k === PRINCESS) push(-1000, t);
            else push(1 + (k <= 2 ? 3 : -k * 0.4) + (k === SPY && !spyOut ? 2 : 0), t);
          } else {
            push(3 + 40 * odds[PRINCESS] + 4 * odds[COUNTESS] + tokenBias, t);
          }
          break;
        }
        case KING: {
          let expected = 0;
          for (const v of CARD_VALUES) expected += v * odds[v];
          const gain = expected - k;
          push(
            (k === PRINCESS ? -15 : 1 + 1.5 * gain) + (sure === PRINCESS ? 30 : 0) + tokenBias,
            t,
          );
          break;
        }
      }
    }
  }

  if (options.length === 0) return null;
  const best = options.reduce((a, b) => (b.score > a.score ? b : a));
  const action: Action = {
    type: 'play_card',
    playerId: me,
    card: best.card,
    ...(best.targetId !== undefined ? { targetId: best.targetId } : {}),
    ...(best.guess !== undefined ? { guess: best.guess } : {}),
  };
  return done(action);
}
