// What bots say at the table. Every remark is decided from the bot's own PlayerView and only from
// public facts of the chronicle: lines never reveal what a bot saw in private (Priest, Baron,
// King) or what it holds. The lines themselves live in ./bot-lines.
import type { BotNotes } from './bot';
import { LINES, type Situation } from './bot-lines';
import type { Random } from './random';
import { type CardValue, cardNames, KING, PRINCE, PRINCESS } from './rules';
import type { GameEvent, GameState, PlayerId } from './types';
import type { PlayerView } from './view';

export { LINES, phraseCount, SITUATIONS, type Situation } from './bot-lines';

/** A public chronicle event: what a bot may comment on (secrets removed). */
export type BotEvent = GameEvent;

/** Public events appended between two states, in order, without their private data. */
export function botEvents(before: GameState, after: GameState): BotEvent[] {
  return after.events.slice(before.events.length).map((e) => {
    const { secret: _secret, ...rest } = e;
    return rest as BotEvent;
  });
}

/** Chronicle key an event is shown under; `ChatLine.after` in the protocol uses it. */
export function eventKey(event: { id: number }): string {
  return `ev-${event.id}`;
}

/** How many lines a bot remembers having said, to avoid repeating itself. */
const MEMORY = 8;

/** One way of reacting to an event: tried in order, each with its own probability. */
export interface RemarkCandidate {
  situation: Situation;
  involved: boolean;
  chance: number;
  /** Placeholders for the lines: `{name}` (the other player involved) and `{card}`. */
  name?: PlayerId;
  card?: CardValue;
}

export interface Remark {
  text: string;
  involved: boolean;
  /** The bot's notes with this line remembered. Keep them and pass them on the next call. */
  notes: BotNotes;
}

interface RoundContext {
  /** Public events of the round up to and including the event. */
  events: GameEvent[];
  alive: PlayerId[];
  protectedIds: Set<PlayerId>;
  /** Spies played or discarded by each player this round (eliminated players keep their count). */
  spies: Map<PlayerId, number>;
  guards: number;
  eliminated: number;
}

function roundContext(view: PlayerView, event: BotEvent): RoundContext {
  const ctx: RoundContext = {
    events: [],
    alive: view.players.map((p) => p.id),
    protectedIds: new Set(),
    spies: new Map(),
    guards: 0,
    eliminated: 0,
  };
  const addSpy = (id: PlayerId) => ctx.spies.set(id, (ctx.spies.get(id) ?? 0) + 1);
  for (const e of view.events) {
    if (e.round !== event.round || e.id > event.id) continue;
    ctx.events.push(e);
    switch (e.type) {
      case 'play':
        if (e.card === 0) addSpy(e.playerId);
        if (e.card === 1) ctx.guards++;
        break;
      case 'prince':
        if (e.discarded === 0) addSpy(e.targetId);
        break;
      case 'protected':
        ctx.protectedIds.add(e.playerId);
        break;
      case 'draw':
        if (e.reason === 'turn') ctx.protectedIds.delete(e.playerId);
        break;
      case 'eliminated':
        ctx.alive = ctx.alive.filter((id) => id !== e.playerId);
        ctx.protectedIds.delete(e.playerId);
        ctx.eliminated++;
        break;
    }
  }
  return ctx;
}

/** The other alive players who have played or discarded a Spy this round. */
function otherSpies(ctx: RoundContext, who: PlayerId): PlayerId[] {
  return ctx.alive.filter((id) => id !== who && (ctx.spies.get(id) ?? 0) > 0);
}

/** Consecutive misses by `playerId` in their latest Guard accusations (whole game). */
function missStreak(view: PlayerView, event: BotEvent, playerId: PlayerId): number {
  let streak = 0;
  for (const e of view.events) {
    if (e.id > event.id || e.type !== 'guess' || e.playerId !== playerId) continue;
    streak = e.correct ? 0 : streak + 1;
  }
  return streak;
}

/** Whether this is the most recent turn draw (so `view.deckSize` is not stale for it). */
function isLatestDraw(view: PlayerView, event: BotEvent): boolean {
  for (let i = view.events.length - 1; i >= 0; i--) {
    const e = view.events[i] as GameEvent;
    if (e.type === 'draw' && e.reason === 'turn') return e.id === event.id;
  }
  return false;
}

/**
 * The reactions the bot of `view` may have to `event`, in priority order. Public so tests (and
 * curious UIs) can see which situations an event triggers; only public facts are used.
 */
export function remarkCandidates(view: PlayerView, event: BotEvent): RemarkCandidate[] {
  const me = view.you.id;
  const ctx = roundContext(view, event);
  const out: RemarkCandidate[] = [];
  const add = (
    situation: Situation,
    chance: number,
    involved = false,
    extra: { name?: PlayerId; card?: CardValue } = {},
  ) => out.push({ situation, chance, involved, ...extra });
  /** Spy situations for `who` having just played/discarded a Spy. */
  const spyCandidates = (who: PlayerId, discarded: boolean) => {
    const count = ctx.spies.get(who) ?? 0;
    const mine = who === me;
    if (count >= 2) add(mine ? 'spy_second_mine' : 'spy_second_other', 0.85, mine, { name: who });
    else if (otherSpies(ctx, who).length > 0) {
      add(mine ? 'spy_competition_mine' : 'spy_competition_other', 0.85, mine, { name: who });
    } else if (discarded) {
      add(mine ? 'spy_discarded_mine' : 'spy_discarded_other', mine ? 0.8 : 0.6, mine, {
        name: who,
      });
    } else {
      add(mine ? 'spy_first_mine' : 'spy_first_other', mine ? 0.5 : 0.3, mine, { name: who });
    }
  };

  switch (event.type) {
    case 'round_start':
      if (event.starterId === me) add('round_start_mine', 0.7, true);
      else add('round_start_other', 0.4, false, { name: event.starterId });
      if (view.players.length === 2) add('round_start_two', 0.5);
      if (event.round > 1) add('round_start_later', 0.3);
      break;

    case 'draw':
      if (event.reason === 'turn' && isLatestDraw(view, event)) {
        if (view.deckSize === 3) add('deck_three', 0.5);
        else if (view.deckSize === 1) add('deck_last', 0.5);
        else if (view.deckSize === 0) add('deck_empty', 0.5);
      }
      break;

    case 'play': {
      if (event.card === 0) spyCandidates(event.playerId, false);
      if (event.card === 8) {
        const mine = event.playerId === me;
        const royals = ctx.events.some(
          (e) => e.type === 'play' && e.id < event.id && (e.card === KING || e.card === PRINCE),
        );
        if (royals && !mine) add('countess_suspect', 0.4, false, { name: event.playerId });
        add(mine ? 'countess_mine' : 'countess_other', mine ? 0.45 : 0.25, mine, {
          name: event.playerId,
        });
      }
      break;
    }

    case 'no_effect':
      if (event.reason === 'no_targets') {
        const mine = event.playerId === me;
        add(mine ? 'no_targets_mine' : 'no_targets_other', mine ? 0.9 : 0.4, mine, {
          name: event.playerId,
        });
      } else if (event.reason === 'empty_deck') {
        const mine = event.playerId === me;
        add('chancellor_short', mine ? 0.7 : 0.4, mine);
      }
      break;

    case 'protected': {
      const mine = event.playerId === me;
      // Everybody the next player could pick (anyone but themselves) is protected.
      const seats = view.players.map((p) => p.id);
      let next = event.playerId;
      for (let i = 1; i <= seats.length; i++) {
        const id = seats[(seats.indexOf(event.playerId) + i) % seats.length] as PlayerId;
        if (ctx.alive.includes(id)) {
          next = id;
          break;
        }
      }
      const targets = ctx.alive.filter((id) => id !== next);
      if (targets.length > 0 && targets.every((id) => ctx.protectedIds.has(id))) {
        add('protected_all', 0.7, mine, { name: event.playerId });
      }
      add(mine ? 'protected_mine' : 'protected_other', mine ? 0.6 : 0.3, mine, {
        name: event.playerId,
      });
      break;
    }

    case 'guess': {
      const mine = event.playerId === me;
      const onMe = event.targetId === me;
      if (onMe && !mine) add('targeted', 0.2, true, { name: event.playerId });
      const count = (chance: number) => {
        if (ctx.guards >= 5) add('guard_count_many', chance);
        else if (ctx.guards === 4) add('guard_count_fourth', chance);
        else if (ctx.guards === 3) add('guard_count_third', chance);
      };
      if (event.correct) {
        if (mine) add('guard_hit_mine', 1, true, { name: event.targetId, card: event.guess });
        else if (onMe) add('guard_hit_on_me', 0.9, true, { name: event.playerId });
        else add('guard_hit_other', 0.35, false, { name: event.playerId });
        count(0.25);
      } else {
        if (missStreak(view, event, event.playerId) >= 2) {
          add(mine ? 'guard_streak_mine' : 'guard_streak_other', 0.6, mine, {
            name: event.playerId,
          });
        }
        count(0.35);
        if (mine) add('guard_miss_mine', 1, true, { name: event.targetId });
        else if (onMe) add('guard_miss_on_me', 0.9, true, { name: event.playerId });
        else add('guard_miss_other', 0.2, false, { name: event.playerId });
      }
      break;
    }

    case 'priest':
      if (event.playerId === me) add('priest_mine', 0.9, true, { name: event.targetId });
      else if (event.targetId === me) add('priest_on_me', 0.9, true, { name: event.playerId });
      else add('priest_other', 0.2, false, { name: event.playerId });
      break;

    case 'baron': {
      const mine = event.playerId === me;
      const involved = mine || event.targetId === me;
      const opponent = mine ? event.targetId : event.playerId;
      if (event.targetId === me && !mine) add('targeted', 0.15, true, { name: event.playerId });
      if (event.loserId === null) {
        if (involved) add('baron_tie_involved', 0.9, true, { name: opponent });
        else add('baron_tie_other', 0.3, false, { name: event.playerId });
      } else {
        const high = (event.loserCard ?? 0) >= KING;
        if (event.loserId === me) {
          add(high ? 'baron_high_loser_mine' : 'baron_lost', high ? 0.6 : 0.9, true, {
            name: opponent,
          });
          if (high) add('baron_lost', 0.9, true, { name: opponent });
        } else if (involved) {
          add('baron_won', 0.9, true, { name: opponent });
        } else if (high) {
          add('baron_high_loser_other', 0.5, false, { name: event.loserId });
          add('baron_other', 0.25, false, { name: event.playerId });
        } else {
          add('baron_other', 0.25, false, { name: event.playerId });
        }
      }
      break;
    }

    case 'king': {
      const mine = event.playerId === me;
      const onMe = event.targetId === me;
      const priestFirst = ctx.events.some(
        (e) =>
          e.type === 'priest' && e.playerId === event.playerId && e.targetId === event.targetId,
      );
      const anyPriest = ctx.events.some(
        (e) =>
          e.type === 'priest' &&
          (e.playerId === event.playerId ||
            e.targetId === event.targetId ||
            e.targetId === event.playerId),
      );
      if (priestFirst) add('king_after_priest', 0.75, mine || onMe, { name: event.playerId });
      else if (anyPriest) add('king_after_priest', 0.3, mine || onMe, { name: event.playerId });
      if (onMe && !mine) add('targeted', 0.15, true, { name: event.playerId });
      if (mine) add('king_mine', 0.9, true, { name: event.targetId });
      else if (onMe) add('king_on_me', 0.9, true, { name: event.playerId });
      else add('king_other', 0.2, false, { name: event.playerId });
      break;
    }

    case 'prince': {
      const mine = event.playerId === me;
      const onMe = event.targetId === me;
      if (event.discarded === PRINCESS) {
        if (onMe) add('prince_princess_me', 1, true, { name: event.playerId });
        else add('prince_princess_other', 0.8, false, { name: event.targetId });
        break;
      }
      if (event.discarded === 0) spyCandidates(event.targetId, true);
      if (event.playerId === event.targetId) {
        add(mine ? 'prince_self_mine' : 'prince_self_other', mine ? 0.7 : 0.35, mine, {
          name: event.playerId,
        });
      } else if (mine) {
        add('prince_mine_on_other', 0.7, true, { name: event.targetId });
      } else if (onMe) {
        add('targeted', 0.2, true, { name: event.playerId });
        add('prince_on_me', 0.9, true, { name: event.playerId });
      } else {
        add('prince_other', 0.15, false, { name: event.playerId });
      }
      break;
    }

    case 'chancellor': {
      const mine = event.playerId === me;
      const short = event.drawn < 2 || (view.deckSize <= 3 && event.id === lastId(view));
      if (short) add('chancellor_short', mine ? 0.8 : 0.4, mine);
      add(mine ? 'chancellor_mine' : 'chancellor_other', mine ? 0.6 : 0.2, mine, {
        name: event.playerId,
      });
      break;
    }

    case 'eliminated': {
      if (event.playerId === me) {
        const princess = event.cause === 'played_princess' || event.cause === 'prince_princess';
        if (princess) add('eliminated_me_princess', 0.85, true);
        add('eliminated_me', 0.7, true);
        break;
      }
      const fell = ctx.spies.get(event.playerId) ?? 0;
      const holders = ctx.alive.filter((id) => (ctx.spies.get(id) ?? 0) > 0);
      if (fell > 0 && holders.length === 1) {
        const sole = holders[0] as PlayerId;
        add(sole === me ? 'spy_sole_mine' : 'spy_sole_other', 0.8, sole === me, { name: sole });
      }
      if (ctx.alive.length === 2) add('two_left', 0.55);
      if (ctx.eliminated === 1) add('eliminated_first', 0.5, false, { name: event.playerId });
      add('eliminated_other', 0.2, false, { name: event.playerId });
      break;
    }

    case 'round_end': {
      const s = event.summary;
      const won = s.winnerIds.includes(me);
      const first = s.winnerIds[0] as PlayerId;
      if (s.spyBonusId === me) add('spy_bonus_mine', 1, true);
      else if (s.spyBonusId) add('spy_bonus_other', 0.6, false, { name: s.spyBonusId });
      const kind =
        s.winnerIds.length > 1
          ? 'shared'
          : s.reason === 'last_standing'
            ? 'last'
            : s.reason === 'highest_hand'
              ? 'hand'
              : 'tiebreak';
      if (kind === 'shared') {
        add(won ? 'round_shared_mine' : 'round_shared_other', won ? 0.8 : 0.4, won, {
          name: first,
        });
      } else {
        const mineKey = {
          last: 'round_win_last_mine',
          hand: 'round_win_hand_mine',
          tiebreak: 'round_win_tiebreak_mine',
        } as const;
        const otherKey = {
          last: 'round_win_last_other',
          hand: 'round_win_hand_other',
          tiebreak: 'round_win_tiebreak_other',
        } as const;
        if (won) add(mineKey[kind], 0.8, true);
        else add(otherKey[kind], 0.45, false, { name: first });
      }
      if (!won) add('round_lost', 0.25);
      if (!s.gameWinnerIds) {
        const goal = view.tokensToWin;
        const near = view.players.filter((p) => (s.tokens[p.id] ?? 0) === goal - 1);
        if (near.some((p) => p.id === me)) add('near_goal_mine', 0.6, true);
        else if (near[0]) add('near_goal_other', 0.5, false, { name: near[0].id });
        const top = Math.max(...Object.values(s.tokens));
        if (top >= 2 && Object.values(s.tokens).filter((t) => t === top).length >= 2) {
          add('token_tie', 0.4);
        }
      }
      break;
    }
  }
  return out;
}

function lastId(view: PlayerView): number {
  return (view.events[view.events.length - 1] as GameEvent | undefined)?.id ?? -1;
}

function fill(
  line: string,
  view: PlayerView,
  name: PlayerId | undefined,
  card: CardValue | undefined,
): string {
  const who = view.players.find((p) => p.id === name)?.name ?? 'alguien';
  return line
    .replaceAll('{name}', who)
    .replaceAll('{card}', card === undefined ? 'esa carta' : cardNames[card]);
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** Picks a line from a pool, avoiding the ones this bot said recently when it can. */
function chooseLine(
  lines: readonly string[],
  recent: readonly string[],
  render: (line: string) => string,
  random: Random,
): string {
  const rendered = lines.map(render);
  const fresh = rendered.filter((t) => !recent.includes(t));
  if (fresh.length > 0) return pick(fresh, random);
  // Everything was said recently: at least never the very last line again.
  const notLast = rendered.filter((t) => t !== recent[recent.length - 1]);
  return pick(notLast.length > 0 ? notLast : rendered, random);
}

function remember(notes: BotNotes, text: string): BotNotes {
  return { ...notes, recent: [...(notes.recent ?? []), text].slice(-MEMORY) };
}

/**
 * A line about `event`, which just happened, from the bot whose view this is; null to stay quiet.
 * `involved` lines (the actor, the target, the eliminated, the winner) come first; onlookers speak
 * only sometimes so the table is not flooded. The returned `notes` remember the line so the bot
 * does not repeat itself.
 */
export function botRemark(
  view: PlayerView,
  notes: BotNotes,
  event: BotEvent,
  random: Random,
): Remark | null {
  for (const cand of remarkCandidates(view, event)) {
    if (random() >= cand.chance) continue;
    const text = chooseLine(
      LINES[cand.situation],
      notes.recent ?? [],
      (l) => fill(l, view, cand.name, cand.card),
      random,
    );
    return { text, involved: cand.involved, notes: remember(notes, text) };
  }
  return null;
}

/** A farewell line once the game is over; every bot may give one. */
export function botFarewell(view: PlayerView, notes: BotNotes, random: Random): string {
  const won = view.winnerIds.includes(view.you.id);
  const long = view.round >= 6;
  const pool =
    won && view.winnerIds.length > 1
      ? LINES.farewell_shared
      : won
        ? long
          ? LINES.farewell_long_win
          : LINES.farewell_win
        : long
          ? LINES.farewell_long_lose
          : LINES.farewell_lose;
  return chooseLine(pool, notes.recent ?? [], (l) => l, random);
}
