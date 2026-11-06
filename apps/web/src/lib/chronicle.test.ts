import { type CardValue, viewFor } from '@loveletter/engine';
import { describe, expect, it } from 'vitest';
import { rig, step } from '../test-utils';
import { chronicle, type TextContext } from './chronicle';
import { buildResults } from './results';

const NAMES: Record<string, string> = { p0: 'Ana', p1: 'Beto', p2: 'Carla' };
const ctxFor = (me: string): TextContext => ({ me, name: (id) => NAMES[id] ?? '?' });
/** Sucesos tal como los ve `me`: con el motor real, sin datos privados ajenos. */
const ev = (state: ReturnType<typeof rig>, me: string) => viewFor(state, me).events;
const play = (
  state: ReturnType<typeof rig>,
  card: CardValue,
  targetId?: string,
  guess?: CardValue,
) =>
  step(state, {
    type: 'play_card',
    playerId: state.activeId as string,
    card,
    targetId,
    guess,
  } as never);

describe('crónica', () => {
  it('redacta la jugada en segunda o tercera persona según quién mira', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 3);
    expect(chronicle(ev(s, 'p0'), ctxFor('p0'))[0]).toBe(
      'Jugaste el Guardia contra Beto y nombró el Barón: acertó. Beto queda fuera.',
    );
    expect(chronicle(ev(s, 'p2'), ctxFor('p2'))[1]).toContain('Ana jugó el Guardia contra Beto');
    expect(chronicle(ev(s, 'p1'), ctxFor('p1'))[0]).toContain('contra ti');
    expect(chronicle(ev(s, 'p1'), ctxFor('p1'))[0]).toContain('Quedas fuera');
  });

  it('el Sacerdote solo cuenta la carta a quien la vio', () => {
    const s = play(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    expect(chronicle(ev(s, 'p0'), ctxFor('p0'))[0]).toContain('tenía un Barón');
    expect(chronicle(ev(s, 'p2'), ctxFor('p2'))[0]).not.toContain('Barón');
  });

  it.each<[CardValue, string]>([
    [0, 'Espía'],
    [4, 'queda protegido'],
    [8, 'sin efecto'],
    [9, 'fuera de la ronda'],
  ])('carta %i', (card, text) => {
    const s = play(rig({ hands: [[card, 2], [3], [4]] }), card);
    expect(chronicle(ev(s, 'p2'), ctxFor('p2'))[0]).toContain(text);
  });

  it('Barón, Príncipe, Rey y Canciller', () => {
    const baron = play(rig({ hands: [[3, 2], [5], [4]] }), 3, 'p1');
    expect(chronicle(ev(baron, 'p2'), ctxFor('p2'))[0]).toContain('la mano de Ana era la más baja');
    const tie = play(rig({ hands: [[3, 3], [3], [4]] }), 3, 'p1');
    expect(chronicle(ev(tie, 'p2'), ctxFor('p2'))[0]).toContain('empate');
    const prince = play(rig({ hands: [[5, 2], [9], [4]] }), 5, 'p1');
    expect(chronicle(ev(prince, 'p0'), ctxFor('p0'))[0]).toContain(
      'descartó la Princesa y Beto queda fuera',
    );
    const self = play(rig({ hands: [[5, 2], [9], [4]] }), 5, 'p0');
    expect(chronicle(ev(self, 'p0'), ctxFor('p0'))[0]).toContain('contra ti');
    const king = play(rig({ hands: [[7, 2], [3], [4]] }), 7, 'p1');
    expect(chronicle(ev(king, 'p0'), ctxFor('p0'))[0]).toContain('Recibiste un Barón');
    expect(chronicle(ev(king, 'p2'), ctxFor('p2'))[0]).not.toContain('Recibiste');
    const chan = play(rig({ hands: [[6, 2], [3], [4]] }), 6);
    expect(chronicle(ev(chan, 'p0'), ctxFor('p0'))[0]).toContain('robaste');
    expect(chronicle(ev(chan, 'p1'), ctxFor('p1'))[0]).toContain('robó 2 cartas');
  });

  it('sin objetivos: sin efecto', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]], protect: [1, 2] }), 1);
    expect(chronicle(ev(s, 'p0'), ctxFor('p0'))[0]).toContain('no había a quién elegir');
  });

  it('fin de ronda y de partida', () => {
    const s = play(rig({ hands: [[1, 2], [3]], tokens: [5, 0] }), 1, 'p1', 3);
    const lines = chronicle(ev(s, 'p1'), ctxFor('p1'));
    expect(lines[0]).toContain('gana la partida');
    expect(lines[1]).toContain('Fin de la ronda 1');
  });
});

describe('resultados', () => {
  it('Guardia: público; Sacerdote: privado; Rey: privado; Barón: público', () => {
    const ctx = ctxFor('p0');
    const guard = buildResults(ev(play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 5), 'p0'), ctx);
    expect(guard[0]).toMatchObject({ title: 'Fallaste.', visibility: 'public', style: 'modal' });
    const priest = buildResults(ev(play(rig({ hands: [[2, 1], [3], [4]] }), 2, 'p1'), 'p0'), ctx);
    expect(priest[0]).toMatchObject({
      visibility: 'private',
      faces: [{ caption: 'Beto', value: 3 }],
    });
    const king = buildResults(ev(play(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1'), 'p0'), ctx);
    expect(king[0]?.faces).toEqual([
      { caption: 'Entregas', value: 1 },
      { caption: 'Recibes', value: 3 },
    ]);
    const baron = buildResults(ev(play(rig({ hands: [[3, 2], [5], [4]] }), 3, 'p1'), 'p0'), ctx);
    expect(baron[0]).toMatchObject({
      visibility: 'public',
      title: 'Pierdes la comparación.',
      hit: true,
    });
  });

  it('cartas triviales: aviso, no ventana', () => {
    const ctx = ctxFor('p0');
    for (const card of [0, 4, 8] as const) {
      const r = buildResults(ev(play(rig({ hands: [[card, 2], [3], [4]] }), card), 'p0'), ctx);
      expect(r[0]?.style).toBe('toast');
    }
    const none = buildResults(
      ev(play(rig({ hands: [[1, 2], [3], [4]], protect: [1, 2] }), 1), 'p0'),
      ctx,
    );
    expect(none[0]).toMatchObject({ style: 'toast', title: 'Sin efecto.' });
  });

  it('no filtra nada a un tercero', () => {
    const s = play(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    expect(buildResults(ev(s, 'p2'), ctxFor('p2'))).toEqual([]);
  });

  it('el Rey avisa a quien lo sufre', () => {
    const s = play(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1');
    const r = buildResults(ev(s, 'p1'), ctxFor('p1'));
    expect(r[0]).toMatchObject({ style: 'toast' });
    expect(r[0]?.body).toContain('Recibiste un Guardia');
  });
});
