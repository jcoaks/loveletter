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

  it('no genera aviso para tus propias jugadas ni para sucesos que no son jugadas', () => {
    const s = play(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    expect(buildResults(ev(s, 'p0'), ctxFor('p0')).every((r) => !r.other)).toBe(true);
  });
});

describe('avisos de jugadas ajenas', () => {
  const notices = (state: ReturnType<typeof rig>, me: string) =>
    buildResults(ev(state, me), ctxFor(me)).filter((r) => r.other);

  it('Guardia fallado contra otro: público, sin afectarte', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 5);
    const [n] = notices(s, 'p2');
    expect(n).toMatchObject({ title: 'Ana jugó el Guardia', visibility: 'public', hit: false });
    expect(n?.other).toMatchObject({ actorId: 'p0', card: 1, targetId: 'p1', affectsMe: false });
    expect(n?.body).toBe('Ana jugó el Guardia contra Beto y nombró el Príncipe: falló.');
  });

  it('Guardia acertado contra otro y contra ti', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 3);
    const [other] = notices(s, 'p2');
    expect(other?.body).toContain('acertó. Beto queda fuera');
    expect(other).toMatchObject({ hit: true });
    expect(other?.other?.affectsMe).toBe(false);
    const [me] = notices(s, 'p1');
    expect(me?.body).toBe('Ana jugó el Guardia contra ti y nombró el Barón: acertó. Quedas fuera.');
    expect(me?.other?.affectsMe).toBe(true);
  });

  it('Guardia fallado contra ti te afecta aunque sigas en juego', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 5);
    const [n] = notices(s, 'p1');
    expect(n?.body).toContain('contra ti');
    expect(n?.body).toContain('falló');
    expect(n?.other?.affectsMe).toBe(true);
  });

  it('Barón: eliminación, empate y contra ti con ambas manos', () => {
    const baron = play(rig({ hands: [[3, 2], [5], [4]] }), 3, 'p1');
    expect(notices(baron, 'p2')[0]?.body).toContain(
      'la mano de Ana era la más baja (Sacerdote) y Ana queda fuera',
    );
    expect(notices(baron, 'p2')[0]?.faces).toEqual([]);
    const tie = play(rig({ hands: [[3, 3], [3], [4]] }), 3, 'p1');
    expect(notices(tie, 'p2')[0]?.body).toContain('empate, nadie queda fuera');
    const mine = notices(baron, 'p1')[0];
    expect(mine?.faces).toEqual([
      { caption: 'Tu mano', value: 5 },
      { caption: 'Ana', value: 2 },
    ]);
    expect(mine?.visibility).toBe('public');
    expect(mine?.other?.affectsMe).toBe(true);
  });

  it('Príncipe sobre otro, sobre sí con la Princesa y sobre ti', () => {
    const onOther = play(rig({ hands: [[5, 2], [3], [4]] }), 5, 'p1');
    expect(notices(onOther, 'p2')[0]?.body).toContain('descartó el Barón y robó una carta nueva');
    const self = play(rig({ hands: [[5, 9], [3], [4]] }), 5, 'p0');
    const [n] = notices(self, 'p2');
    expect(n?.body).toBe(
      'Ana jugó el Príncipe contra sí mismo: descartó la Princesa y Ana queda fuera.',
    );
    expect(n?.hit).toBe(true);
    const onMe = play(rig({ hands: [[5, 2], [3], [4]], deck: [8, 1, 1, 1] }), 5, 'p1');
    const mine = notices(onMe, 'p1')[0];
    expect(mine?.faces).toEqual([
      { caption: 'Descartas', value: 3 },
      { caption: 'Nueva', value: 8 },
    ]);
    expect(mine?.visibility).toBe('private');
    // Un tercero no ve la carta nueva.
    expect(notices(onMe, 'p2')[0]?.faces).toEqual([]);
  });

  it('Doncella, Espía y Canciller no tienen objetivo', () => {
    for (const [card, text] of [
      [4, 'queda protegido'],
      [0, 'sin efecto'],
      [6, 'robó 2 cartas'],
    ] as const) {
      const s = play(rig({ hands: [[card, 2], [3], [4]] }), card);
      const [n] = notices(s, 'p2');
      expect(n?.body).toContain(text);
      expect(n?.other).toMatchObject({ targetId: null, affectsMe: false });
    }
  });

  it('Rey y Sacerdote como objetivo; un tercero no ve nada secreto', () => {
    const king = play(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1');
    const [k] = notices(king, 'p1');
    expect(k?.body).toContain('Recibiste un Guardia');
    expect(k?.faces).toContainEqual({ caption: 'Recibes', value: 1 });
    expect(k).toMatchObject({ visibility: 'private' });
    expect(k?.other?.affectsMe).toBe(true);
    const third = notices(king, 'p2')[0];
    expect(third?.faces).toEqual([]);
    expect(third?.body).not.toMatch(/Recibiste|Guardia|Barón/);

    const priest = play(rig({ hands: [[2, 7], [3], [4]] }), 2, 'p1');
    const [p] = notices(priest, 'p1');
    expect(p?.body).toBe('Ana jugó el Sacerdote y miró tu mano.');
    expect(p?.other?.affectsMe).toBe(true);
    expect(notices(priest, 'p2')[0]?.body).toBe('Ana jugó el Sacerdote y miró la mano de Beto.');
  });

  it('varias jugadas seguidas salen en orden', () => {
    const s = play(play(rig({ hands: [[4, 2], [1], [3]], deck: [5, 1, 1, 1] }), 4), 1, 'p2', 5);
    const list = notices(s, 'p2');
    expect(list.map((n) => n.other?.actorId)).toEqual(['p0', 'p1']);
    const ids = list.map((n) => Number(n.key.slice(3)));
    expect(ids[0]).toBeLessThan(ids[1] as number);
  });
});
