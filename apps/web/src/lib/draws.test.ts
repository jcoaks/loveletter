import { type CardValue, viewFor } from '@loveletter/engine';
import { describe, expect, it } from 'vitest';
import { rig, step } from '../test-utils';
import { drawAnimations, TURN_DRAW_DELAY_MS } from './draws';

const play = (s: ReturnType<typeof rig>, card: CardValue, targetId?: string, guess?: CardValue) =>
  step(s, { type: 'play_card', playerId: s.activeId as string, card, targetId, guess });

const fresh = (state: ReturnType<typeof rig>, me: string, afterId = -1) =>
  viewFor(state, me).events.filter((e) => e.id > afterId);

describe('drawAnimations', () => {
  it('turno normal: tu robo enseña la carta; el de un rival no', () => {
    const s = play(rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] }), 4);
    // Tras la Doncella de Ana roba Beto.
    const forMe = drawAnimations(fresh(s, 'p0'), 'p0');
    expect(forMe).toHaveLength(1);
    expect(forMe[0]).toMatchObject({ playerId: 'p1', mine: false });
    expect(forMe[0]?.card).toBeUndefined();
    const forBeto = drawAnimations(fresh(s, 'p1'), 'p1');
    expect(forBeto[0]).toMatchObject({ playerId: 'p1', mine: true, card: 7 });
  });

  it('Príncipe: el objetivo roba, y si eres tú ves la carta', () => {
    const s = play(rig({ hands: [[5, 2], [3], [4]], deck: [8, 1, 1, 1] }), 5, 'p1');
    const anims = drawAnimations(fresh(s, 'p1'), 'p1');
    // El robo del Príncipe y, enseguida, el de inicio de su turno.
    expect(anims.map((a) => [a.playerId, a.mine])).toEqual([
      ['p1', true],
      ['p1', true],
    ]);
    expect(anims.map((a) => a.card)).toEqual([8, 1]);
    // Un tercero ve los mismos vuelos, sin caras.
    expect(drawAnimations(fresh(s, 'p2'), 'p2').map((a) => a.card)).toEqual([undefined, undefined]);
    expect(anims[1]?.delay).toBeGreaterThan(anims[0]?.delay ?? 0);
  });

  it('Príncipe sobre la Princesa: no hay robo del objetivo', () => {
    const s = play(rig({ hands: [[5, 2], [9], [4]], deck: [8, 1, 1, 1] }), 5, 'p1');
    const anims = drawAnimations(fresh(s, 'p2'), 'p2');
    expect(anims.map((a) => a.playerId)).toEqual(['p2']);
  });

  it('Canciller: 2 cartas escalonadas, con sus caras para quien juega', () => {
    const s = play(rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1] }), 6);
    const mine = drawAnimations(fresh(s, 'p0'), 'p0');
    expect(mine).toHaveLength(2);
    expect(mine.map((a) => a.card)).toEqual([7, 8]);
    expect(mine[1]?.delay).toBeCloseTo(0.12);
    const other = drawAnimations(fresh(s, 'p1'), 'p1');
    expect(other.every((a) => !a.mine && a.card === undefined)).toBe(true);
    expect(other).toHaveLength(2);
  });

  it('Canciller con 1 carta en el mazo: 1 animación; con 0: ninguna', () => {
    const one = play(rig({ hands: [[6, 2], [3], [4]], deck: [7] }), 6);
    expect(drawAnimations(fresh(one, 'p0'), 'p0')).toHaveLength(1);
    const none = play(rig({ hands: [[6, 2], [3], [4]], deck: [] }), 6);
    expect(drawAnimations(fresh(none, 'p0'), 'p0')).toEqual([]);
  });

  it('reconexión: sin sucesos nuevos no hay animaciones', () => {
    const s = play(rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] }), 4);
    const last = viewFor(s, 'p0').events.at(-1)?.id ?? 0;
    expect(drawAnimations(fresh(s, 'p0', last), 'p0')).toEqual([]);
  });

  it('varias seguidas: se limita a las últimas y mantiene el orden', () => {
    let s = rig({ hands: [[4, 2], [4], [4], [4]], deck: [1, 1, 1, 1, 1, 1, 1, 1] });
    for (let i = 0; i < 4; i++) s = play(s, 4);
    const anims = drawAnimations(fresh(s, 'p0'), 'p0');
    expect(anims.length).toBeLessThanOrEqual(6);
    expect(anims[0]?.delay).toBe(0);
    const delays = anims.map((a) => a.delay);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });

  it('el robo desde la carta apartada no se anima', () => {
    const s = play(rig({ hands: [[5, 2], [3], [4]], deck: [] }), 5, 'p1');
    const events = fresh(s, 'p1').filter((e) => e.type === 'draw');
    expect(
      events.length === 0 || events.every((e) => e.type === 'draw' && e.from === 'set_aside'),
    ).toBe(true);
    expect(drawAnimations(fresh(s, 'p1'), 'p1')).toEqual([]);
  });
});

describe('drawAnimations: el Canciller devuelve al fondo', () => {
  const chancellor = (deck: CardValue[], keep: CardValue, bottomOrder: CardValue[]) => {
    const s = play(rig({ hands: [[6, 2], [3], [4]], deck }), 6);
    return step(s, { type: 'chancellor_keep', playerId: 'p0', keep, bottomOrder });
  };
  const returns = (state: ReturnType<typeof rig>, me: string, bottom?: CardValue[]) =>
    drawAnimations(fresh(state, me), me, bottom).filter((a) => a.kind === 'return');

  it('devuelve 2: tuyas con sus caras, la más profunda llega primero y la primera en robarse queda encima', () => {
    const s = chancellor([7, 8, 1, 1], 2, [8, 7]);
    const r = returns(s, 'p0', [8, 7]);
    expect(r).toHaveLength(2);
    expect(r.every((a) => a.mine && a.playerId === 'p0')).toBe(true);
    // bottomOrder[0] = 8 es la primera que se robará: queda encima y entra la segunda.
    expect(r.map((a) => a.card)).toEqual([7, 8]);
    expect(r[0]?.key).toMatch(/-r1$/);
    expect((r[1]?.delay ?? 0) - (r[0]?.delay ?? 0)).toBeCloseTo(0.12);
    // El Canciller se anima entero: las 2 que robó y las 2 que devuelve, en ese orden.
    const all = drawAnimations(fresh(s, 'p0'), 'p0', [8, 7]);
    // y luego el robo de inicio de turno del siguiente jugador.
    expect(all.map((a) => a.kind)).toEqual(['draw', 'draw', 'return', 'return', 'draw']);
  });

  it('un rival ve dos reversos (sin caras) saliendo de su asiento', () => {
    const s = chancellor([7, 8, 1, 1], 2, [8, 7]);
    const r = returns(s, 'p1', [8, 7]);
    expect(r).toHaveLength(2);
    expect(r.every((a) => !a.mine && a.playerId === 'p0' && a.card === undefined)).toBe(true);
  });

  it('sin saber lo que elegiste (p. ej. recargaste) no inventa caras', () => {
    const s = chancellor([7, 8, 1, 1], 2, [8, 7]);
    expect(returns(s, 'p0').every((a) => a.card === undefined)).toBe(true);
    expect(returns(s, 'p0', [8]).every((a) => a.card === undefined)).toBe(true);
  });

  it('devuelve 1 si el mazo solo tenía 1; con el mazo vacío no hay efecto ni vuelo', () => {
    const one = chancellor([7], 2, [7]);
    expect(returns(one, 'p0', [7])).toHaveLength(1);
    const empty = play(rig({ hands: [[6, 2], [3], [4]], deck: [] }), 6);
    expect(drawAnimations(fresh(empty, 'p0'), 'p0')).toEqual([]);
  });

  it('reconexión: sin sucesos nuevos no se repite', () => {
    const s = chancellor([7, 8, 1, 1], 2, [8, 7]);
    const last = viewFor(s, 'p0').events.at(-1)?.id ?? 0;
    expect(drawAnimations(fresh(s, 'p0', last), 'p0', [8, 7])).toEqual([]);
  });
});

describe('drawAnimations: robo de inicio de turno', () => {
  it('solo el robo de turno lleva la pausa (no el del Príncipe ni el del Canciller)', () => {
    expect(TURN_DRAW_DELAY_MS).toBe(1000);
    const turn = play(rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] }), 4);
    expect(drawAnimations(fresh(turn, 'p2'), 'p2').map((a) => a.turnStart)).toEqual([true]);
    const prince = play(rig({ hands: [[5, 2], [3], [4]], deck: [8, 1, 1, 1] }), 5, 'p1');
    expect(drawAnimations(fresh(prince, 'p2'), 'p2').map((a) => !!a.turnStart)).toEqual([
      false,
      true,
    ]);
    const chan = play(rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1] }), 6);
    expect(
      drawAnimations(fresh(chan, 'p1'), 'p1')
        .filter((a) => a.kind === 'draw')
        .map((a) => !!a.turnStart),
    ).toEqual([false, false]);
  });
});
