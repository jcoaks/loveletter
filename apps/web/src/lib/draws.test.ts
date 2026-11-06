import { type CardValue, viewFor } from '@loveletter/engine';
import { describe, expect, it } from 'vitest';
import { rig, step } from '../test-utils';
import { drawAnimations } from './draws';

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
    expect(anims.length).toBeLessThanOrEqual(3);
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
