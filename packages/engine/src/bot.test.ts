import { describe, expect, it } from 'vitest';
import { chooseBotAction, emptyBotNotes, handOdds, knownHands, unseenCards } from './bot';
import { seededRandom } from './random';
import { act, errorOf, play, rig } from './test-helpers';
import { viewFor } from './view';

const decide = (state: ReturnType<typeof rig>, id: string) =>
  chooseBotAction(viewFor(state, id), emptyBotNotes(), seededRandom(3))?.action;

describe('bot', () => {
  it('no hace nada fuera de su turno y confirma el fin de ronda', () => {
    const s = rig({ hands: [[1, 5], [3], [2]] });
    expect(decide(s, 'p1')).toBeUndefined();
    const t0 = rig({ hands: [[1, 5], [3]] });
    const t = act(t0, play(t0, 'p0', 1, 'p1', 3));
    expect(decide(t, 'p1')).toEqual({ type: 'continue_round', playerId: 'p1' });
    const u = act(t, { type: 'continue_round', playerId: 'p1' });
    expect(decide(u, 'p1')).toBeUndefined();
  });

  it('juega la Condesa cuando está forzada', () => {
    const s = rig({ hands: [[8, 7], [3], [2]] });
    expect(decide(s, 'p0')).toMatchObject({ type: 'play_card', card: 8 });
  });

  it('nunca juega la Princesa si tiene otra opción', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = rig({ hands: [[9, 0], [3], [2]] });
      const a = chooseBotAction(viewFor(s, 'p0'), emptyBotNotes(), seededRandom(seed))?.action;
      expect(a).toMatchObject({ card: 0 });
    }
  });

  it('con el Guardia usa lo que sabe: tras el Sacerdote acusa con certeza', () => {
    // p0 jugó Sacerdote sobre p1 (tiene un 6); ahora tiene Guardia.
    const s0 = rig({ hands: [[2, 1], [6], [4]], deck: [1, 1, 1, 1] });
    const s1 = act(s0, play(s0, 'p0', 2, 'p1'));
    const s2 = act(s1, play(s1, 'p1', 1, 'p2', 3)); // p1 juega el Guardia que robó
    const s3 = act(s2, play(s2, 'p2', 4)); // p2 se protege (4 en mano)
    expect(s3.activeId).toBe('p0');
    const v = viewFor(s3, 'p0');
    expect(knownHands(v).get('p1')).toBe(6);
    const a = chooseBotAction(v, emptyBotNotes(), seededRandom(1))?.action;
    expect(a).toMatchObject({ card: 1, targetId: 'p1', guess: 6 });
  });

  it('no lanza un Barón perdido de antemano', () => {
    // p0 conoce (Sacerdote) un 8 en p1 y tiene Barón + Espía: no debe jugar el Barón.
    const s0 = rig({ hands: [[2, 3], [8], [4]], deck: [1, 1, 0, 1] });
    const s1 = act(s0, play(s0, 'p0', 2, 'p1'));
    const s2 = act(s1, play(s1, 'p1', 8));
    const s3 = act(s2, play(s2, 'p2', 4));
    // p0 ahora tiene Barón + carta robada (0)
    const v = viewFor(s3, 'p0');
    expect(v.you.hand.slice().sort()).toEqual([0, 3]);
    const a = chooseBotAction(v, emptyBotNotes(), seededRandom(1))?.action;
    expect(a).toMatchObject({ card: 0 });
  });

  it('con el Canciller conserva la mejor carta y ordena el resto', () => {
    const s0 = rig({ hands: [[6, 2], [3], [4]], deck: [9, 1, 5] });
    const s = act(s0, play(s0, 'p0', 6));
    const a = decide(s, 'p0');
    expect(a).toMatchObject({ type: 'chancellor_keep', keep: 9 });
    expect(errorOf(s, a as never)).toBeNull();
  });

  it('cuenta las copias que no ha visto', () => {
    const s = rig({ hands: [[1, 5], [3]], discards: { 1: [1, 1, 1, 1, 1] }, faceUp: [1] });
    const left = unseenCards(viewFor(s, 'p0'));
    expect(left[1]).toBe(0); // 5 descartadas + 1 boca arriba (+ la de su mano ya no cabe)
    const odds = handOdds(viewFor(s, 'p0'), 'p1');
    expect(odds[1]).toBe(0);
    expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('el conocimiento del Rey se mueve con la carta', () => {
    const s0 = rig({ hands: [[7, 2], [5], [4]], deck: [1, 1, 1] });
    const s = act(s0, play(s0, 'p0', 7, 'p1'));
    // p0 ahora tiene el 5 y sabe que p1 tiene el 2
    expect(knownHands(viewFor(s, 'p0')).get('p1')).toBe(2);
    // p2, ajeno, no sabe nada
    expect(knownHands(viewFor(s, 'p2')).size).toBe(0);
  });
});
