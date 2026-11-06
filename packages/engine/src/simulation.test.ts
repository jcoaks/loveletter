import { describe, expect, it } from 'vitest';
import { createBotNotes } from './bot';
import { botEvents, botFarewell, botRemark } from './bot-talk';
import { countCards } from './game';
import { type Random, seededRandom, shuffle } from './random';
import type { CardValue } from './rules';
import { simulate } from './test-helpers';
import type { GameState } from './types';
import { viewFor } from './view';

const FORBIDDEN_KEYS = ['hands', 'deck', 'setAside', 'originalSetAside', 'secretHands'];

function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysOf(v, into);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      // Addressed events are checked separately; summaries of finished rounds are public.
      if (k === 'secret' || k === 'summary' || k === 'history') continue;
      into.add(k);
      keysOf(v, into);
    }
  }
  return into;
}

/** Same game as seen from `viewerId`, but with every hidden card replaced by a different one. */
function scramble(state: GameState, viewerId: string, random: Random): GameState {
  const copy = structuredClone(state);
  const others = copy.players.map((p) => p.id).filter((id) => id !== viewerId);
  const pool: CardValue[] = [
    ...copy.deck,
    ...(copy.setAside === null ? [] : [copy.setAside]),
    ...others.flatMap((id) => copy.hands[id] as CardValue[]),
  ];
  const mixed = shuffle(pool, random);
  copy.deck = mixed.splice(0, copy.deck.length);
  if (copy.setAside !== null) copy.setAside = mixed.shift() as CardValue;
  for (const id of others) copy.hands[id] = mixed.splice(0, (copy.hands[id] as CardValue[]).length);
  return copy;
}

function checkViews(state: GameState, random: Random): void {
  for (const p of state.players) {
    const view = viewFor(state, p.id);
    const keys = keysOf(view);
    if (state.phase === 'turn' || state.phase === 'chancellor') {
      expect(view.summary).toBeNull();
      expect(JSON.stringify(view.events.filter((e) => e.type !== 'round_end'))).not.toContain(
        'setAside',
      );
    }
    for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
    // Private details only on events addressed to the viewer.
    for (const e of view.events) if (e.secret) expect(e.secret.to).toContain(p.id);
    // Others' hand sizes are public, identities are not: scrambling hidden cards changes nothing.
    expect(viewFor(scramble(state, p.id, random), p.id)).toEqual(view);
    // Only the owner sees a hand.
    expect(view.you.hand).toEqual(state.hands[p.id]);
  }
}

describe('simulaciones completas', () => {
  const GAMES = 3000;

  it(`${GAMES} partidas con bots terminan con el invariante de 21 cartas`, () => {
    const stats = { rounds: 0, byCount: new Map<number, number>() };
    for (let i = 0; i < GAMES; i++) {
      const n = 2 + (i % 5);
      const end = simulate(n, i, 'bot', (_before, _action, after) => {
        if (after.phase !== 'round_over' && after.phase !== 'game_over') {
          // no se revela nada de más y no se pierden cartas
        }
        if (countCards(after) !== 21) throw new Error(`Partida ${i}: ${countCards(after)} cartas`);
      });
      expect(end.phase).toBe('game_over');
      expect(end.winnerIds.length).toBeGreaterThan(0);
      for (const id of end.winnerIds)
        expect(end.tokens[id]).toBeGreaterThanOrEqual(end.tokensToWin);
      stats.rounds += end.round;
      stats.byCount.set(n, (stats.byCount.get(n) ?? 0) + 1);
    }
    expect([...stats.byCount.keys()].sort()).toEqual([2, 3, 4, 5, 6]);
    expect(stats.rounds).toBeGreaterThan(GAMES);
  }, 300_000);

  it('partidas con jugadas aleatorias legales (explora todos los caminos)', () => {
    for (let i = 0; i < 600; i++) {
      const n = 2 + (i % 5);
      const end = simulate(n, 10_000 + i, 'random', (_b, _a, after) => {
        if (countCards(after) !== 21) throw new Error(`Partida ${i}: ${countCards(after)} cartas`);
      });
      expect(end.phase).toBe('game_over');
    }
  }, 300_000);

  it('las vistas nunca filtran manos ajenas, el mazo ni la carta apartada', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 120; i++) {
      const n = 2 + (i % 5);
      let step = 0;
      simulate(n, 50_000 + i, i % 2 === 0 ? 'bot' : 'random', (_b, _a, after) => {
        if (step++ % 3 === 0) checkViews(after, random);
      });
    }
  }, 300_000);

  it('hay 60 o más frases distintas y ninguna viene vacía', () => {
    const texts = new Set<string>();
    const random = seededRandom(5);
    for (let i = 0; i < 400; i++) {
      const n = 2 + (i % 5);
      simulate(n, 80_000 + i, 'bot', (before, _a, after) => {
        for (const event of botEvents(before, after)) {
          for (const p of after.players) {
            const view = viewFor(after, p.id);
            const line = botRemark(view, createBotNotes(random), event, random);
            if (line) texts.add(line.text);
          }
        }
        if (after.phase === 'game_over' && before.phase !== 'game_over') {
          for (const p of after.players) {
            texts.add(botFarewell(viewFor(after, p.id), createBotNotes(random), random));
          }
        }
      });
    }
    expect(texts.size).toBeGreaterThanOrEqual(60);
    expect([...texts].every((t) => t.trim().length > 0)).toBe(true);
  }, 300_000);
});
