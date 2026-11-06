import { describe, expect, it } from 'vitest';
import { countCards } from './game';
import { seededRandom } from './random';
import { buildDeck, DECK_SIZE, tokensToWin } from './rules';
import { createGame } from './setup';
import { makePlayers } from './test-helpers';

describe('mazo y reglas', () => {
  it('tiene 21 cartas con las copias de la edición 2019', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(21);
    expect(DECK_SIZE).toBe(21);
    const count = (v: number) => deck.filter((c) => c === v).length;
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(count)).toEqual([2, 6, 2, 2, 2, 2, 2, 1, 1, 1]);
  });

  it('meta de fichas por número de jugadores', () => {
    expect([2, 3, 4, 5, 6].map(tokensToWin)).toEqual([6, 5, 4, 3, 3]);
    expect(() => tokensToWin(7)).toThrow();
  });
});

describe('createGame', () => {
  it('rechaza mesas de tamaño inválido o con ids repetidos', () => {
    for (const n of [0, 1, 7]) {
      const r = createGame({ players: makePlayers(Math.min(n, 8)).slice(0, n) }, seededRandom(1));
      expect(r.ok).toBe(false);
    }
    const dup = [
      { id: 'a', name: 'A' },
      { id: 'a', name: 'B' },
    ];
    const r = createGame({ players: dup }, seededRandom(1));
    expect(!r.ok && r.error.code).toBe('duplicate_player');
    const bad = createGame({ players: makePlayers(3), starterId: 'x' }, seededRandom(1));
    expect(bad.ok).toBe(false);
  });

  it.each([2, 3, 4, 5, 6])('%i jugadores: reparto correcto', (n) => {
    const r = createGame({ players: makePlayers(n) }, seededRandom(n));
    if (!r.ok) throw new Error('no debería fallar');
    const s = r.value;
    expect(countCards(s)).toBe(21);
    expect(s.setAside).not.toBeNull();
    expect(s.faceUp).toHaveLength(n === 2 ? 3 : 0);
    // el jugador activo ya robó
    const sizes = s.players.map((p) => (s.hands[p.id] as number[]).length);
    expect(sizes.filter((x) => x === 2)).toHaveLength(1);
    expect(sizes.filter((x) => x === 1)).toHaveLength(n - 1);
    expect(s.hands[s.activeId as string]).toHaveLength(2);
    expect(s.deck).toHaveLength(21 - 1 - (n === 2 ? 3 : 0) - n - 1);
    expect(s.tokensToWin).toBe(tokensToWin(n));
    expect(s.round).toBe(1);
    expect(s.phase).toBe('turn');
  });

  it('es determinista con la misma semilla y el primero es aleatorio', () => {
    const a = createGame({ players: makePlayers(4) }, seededRandom(42));
    const b = createGame({ players: makePlayers(4) }, seededRandom(42));
    expect(a).toEqual(b);
    const starters = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const r = createGame({ players: makePlayers(4) }, seededRandom(seed));
      if (r.ok) starters.add(r.value.activeId as string);
    }
    expect(starters.size).toBe(4);
  });

  it('el estado es serializable a JSON sin pérdidas', () => {
    const r = createGame({ players: makePlayers(3) }, seededRandom(3));
    if (!r.ok) throw new Error('x');
    expect(JSON.parse(JSON.stringify(r.value))).toEqual(r.value);
  });
});
