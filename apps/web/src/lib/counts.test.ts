import { type CardValue, viewFor } from '@loveletter/engine';
import { describe, expect, it } from 'vitest';
import { rig, step } from '../test-utils';
import { cardCounts } from './counts';

const left = (view: Parameters<typeof cardCounts>[0]) =>
  Object.fromEntries(Object.entries(cardCounts(view)).map(([v, c]) => [v, c.left]));

describe('cardCounts', () => {
  it('descuenta tu mano y deja el resto por aparecer', () => {
    const s = rig({ hands: [[1, 3], [2], [4]] });
    const c = cardCounts(viewFor(s, 'p0'));
    expect(c[1]).toEqual({ total: 6, seen: 1, left: 5 });
    expect(c[3]).toEqual({ total: 2, seen: 1, left: 1 });
    expect(c[9]).toEqual({ total: 1, seen: 0, left: 1 });
    // La mano ajena no se ve: el Sacerdote de Beto sigue "por aparecer".
    expect(c[2].left).toBe(2);
  });

  it('suma los descartes de todos, varios de la misma carta', () => {
    const s = rig({
      hands: [[1, 3], [2], [4]],
      discards: { 0: [1, 1], 1: [1, 5], 2: [0] },
    });
    const c = cardCounts(viewFor(s, 'p2'));
    // Guardia: 3 descartados; tu mano (Doncella) no cuenta como Guardia.
    expect(c[1]).toEqual({ total: 6, seen: 3, left: 3 });
    expect(c[5].left).toBe(1);
    expect(c[0].left).toBe(1);
    expect(c[4]).toEqual({ total: 2, seen: 1, left: 1 });
  });

  it('con 2 jugadores cuenta las 3 boca arriba', () => {
    const s = rig({ hands: [[1, 3], [2]] });
    s.faceUp = [1, 1, 9];
    const c = cardCounts(viewFor(s, 'p0'));
    expect(c[1]).toEqual({ total: 6, seen: 3, left: 3 });
    expect(c[9]).toEqual({ total: 1, seen: 1, left: 0 });
  });

  it('un eliminado no cuenta dos veces su mano', () => {
    const s = step(rig({ hands: [[1, 2], [3], [4]] }), {
      type: 'play_card',
      playerId: 'p0',
      card: 1,
      targetId: 'p1',
      guess: 3,
    });
    const v = viewFor(s, 'p2');
    // Beto cayó con un Barón y Ana jugó un Guardia: ambos están en los descartes, una sola vez.
    expect(v.players[1]?.handSize).toBe(0);
    const c = cardCounts(v);
    expect(c[3]).toEqual({ total: 2, seen: 1, left: 1 });
    // El Guardia jugado (descarte) y el que Carla robó en su turno (tu mano).
    expect(c[1].seen).toBe(2);
  });

  it('solo cuenta la ronda actual', () => {
    let s = rig({ hands: [[1, 2], [3]], discards: { 0: [5, 5] } });
    s.faceUp = [];
    s = step(s, { type: 'play_card', playerId: 'p0', card: 1, targetId: 'p1', guess: 3 });
    expect(s.phase).toBe('round_over');
    s = step(
      s,
      { type: 'continue_round', playerId: 'p0' },
      { type: 'continue_round', playerId: 'p1' },
    );
    const v = viewFor(s, 'p0');
    expect(v.round).toBe(2);
    const c = cardCounts(v);
    const visible = (Object.values(c) as { seen: number }[]).reduce((n, x) => n + x.seen, 0);
    // Mano propia (2 o 1 carta) + 3 boca arriba + lo descartado desde el reparto.
    const expected =
      v.you.hand.length + v.faceUp.length + v.players.reduce((n, p) => n + p.discards.length, 0);
    expect(visible).toBe(expected);
    expect(v.players.every((p) => p.discards.length === 0)).toBe(true);
  });

  it('nunca da negativos', () => {
    const s = rig({ hands: [[1, 1], [1]], discards: { 0: [1, 1, 1, 1, 1, 1] } });
    const l = left(viewFor(s, 'p0')) as Record<CardValue, number>;
    expect(l[1]).toBe(0);
  });
});
