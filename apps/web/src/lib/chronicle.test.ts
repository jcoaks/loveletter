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
      'Jugaste el Guardia contra Beto y nombraste el Barón: acertaste. Beto queda fuera.',
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
    [0, 'jugó el Espía.'],
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
    expect(chronicle(ev(king, 'p0'), ctxFor('p0'))[0]).toContain('recibiste un Barón');
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

describe('avisos de tus propias jugadas', () => {
  const own = (state: ReturnType<typeof rig>) => buildResults(ev(state, 'p0'), ctxFor('p0'));

  it('es el mismo aviso que ven los demás, con "Tú jugaste" como actor', () => {
    const s = play(rig({ hands: [[0, 2], [3], [4]] }), 0);
    const mine = own(s)[0];
    const theirs = buildResults(ev(s, 'p1'), ctxFor('p1')).filter((r) => r.other)[0];
    expect(mine?.title).toBe('Tú jugaste el Espía');
    expect(theirs?.title).toBe('Ana jugó el Espía');
    expect(mine?.body).toBe('Jugaste el Espía.');
    expect(theirs?.body).toBe('Ana jugó el Espía.');
    // Mismo componente y estructura: carta, actor, resultado y etiqueta pública.
    expect(mine).toMatchObject({ style: 'modal', visibility: 'public' });
    expect(mine?.other).toMatchObject({ actorId: 'p0', card: 0, targetId: null, affectsMe: false });
    expect(mine?.secretFaces).toEqual([]);
  });

  it.each([
    [
      4,
      'Jugaste la Doncella: quedas protegido hasta tu próximo turno.',
      'Ana jugó la Doncella: queda protegido hasta su próximo turno.',
    ],
    [8, 'Jugaste la Condesa: sin efecto.', 'Ana jugó la Condesa: sin efecto.'],
  ] as const)(
    'carta %i: texto espejo del de los demás, sin explicaciones largas',
    (card, mine, theirs) => {
      const s = play(rig({ hands: [[card, 2], [3], [4]] }), card);
      expect(own(s)[0]?.body).toBe(mine);
      expect(buildResults(ev(s, 'p2'), ctxFor('p2'))[0]?.body).toBe(theirs);
    },
  );

  it('sin objetivos: mismo aviso con el motivo', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]], protect: [1, 2] }), 1);
    expect(own(s)[0]?.body).toBe('Jugaste el Guardia, pero no había a quién elegir: sin efecto.');
    expect(own(s)[0]?.other?.affectsMe).toBe(false);
  });

  it('Guardia: el texto público de quien juega y de quien mira son el mismo', () => {
    const s = play(rig({ hands: [[1, 2], [3], [4]] }), 1, 'p1', 5);
    expect(own(s)[0]?.body).toBe(
      'Jugaste el Guardia contra Beto y nombraste el Príncipe: fallaste.',
    );
    expect(buildResults(ev(s, 'p2'), ctxFor('p2'))[0]?.body).toBe(
      'Ana jugó el Guardia contra Beto y nombró el Príncipe: falló.',
    );
  });

  it('la información privada va aparte, solo para ti', () => {
    const priest = own(play(rig({ hands: [[2, 1], [3], [4]] }), 2, 'p1'))[0];
    expect(priest?.visibility).toBe('public');
    expect(priest?.body).toBe('Jugaste el Sacerdote y miraste la mano de Beto: tenía un Barón.');
    expect(priest?.secretFaces).toEqual([{ caption: 'Beto', value: 3 }]);
    expect(priest?.other?.affectsMe).toBe(true);
    const king = own(play(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1'))[0];
    expect(king?.secretFaces).toEqual([
      { caption: 'Entregas', value: 1 },
      { caption: 'Recibes', value: 3 },
    ]);
    const baron = own(play(rig({ hands: [[3, 2], [5], [4]] }), 3, 'p1'))[0];
    expect(baron?.secretFaces).toEqual([
      { caption: 'Tu mano', value: 2 },
      { caption: 'Beto', value: 5 },
    ]);
    expect(baron).toMatchObject({ hit: true });
    expect(baron?.other?.affectsMe).toBe(true);
  });

  it('Príncipe sobre ti mismo: tu carta nueva es privada', () => {
    const s = play(rig({ hands: [[5, 2], [3], [4]], deck: [8, 1, 1, 1] }), 5, 'p0');
    expect(own(s)[0]?.secretFaces).toEqual([{ caption: 'Tu carta nueva', value: 8 }]);
    // Quien mira no la ve.
    expect(buildResults(ev(s, 'p2'), ctxFor('p2'))[0]?.secretFaces).toEqual([]);
  });

  it('el Canciller propio no genera aviso de jugada (abre su elección)', () => {
    const s = play(rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1] }), 6);
    expect(own(s)).toEqual([]);
  });

  it('el Canciller sin cartas en el mazo sí avisa', () => {
    const s = play(rig({ hands: [[6, 2], [3], [4]], deck: [] }), 6);
    expect(own(s)[0]?.body).toBe('Jugaste el Canciller: sin cartas que robar, sin efecto.');
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
    expect(notices(baron, 'p2')[0]?.secretFaces).toEqual([]);
    const tie = play(rig({ hands: [[3, 3], [3], [4]] }), 3, 'p1');
    expect(notices(tie, 'p2')[0]?.body).toContain('empate, nadie queda fuera');
    const mine = notices(baron, 'p1')[0];
    expect(mine?.secretFaces).toEqual([
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
    expect(mine?.secretFaces).toEqual([{ caption: 'Tu carta nueva', value: 8 }]);
    expect(mine?.visibility).toBe('public');
    // Un tercero no ve la carta nueva.
    expect(notices(onMe, 'p2')[0]?.secretFaces).toEqual([]);
  });

  it('Doncella y Espía no tienen objetivo', () => {
    for (const [card, text] of [
      [4, 'queda protegido'],
      [0, 'jugó el Espía.'],
    ] as const) {
      const s = play(rig({ hands: [[card, 2], [3], [4]] }), card);
      const [n] = notices(s, 'p2');
      expect(n?.body).toContain(text);
      expect(n?.other).toMatchObject({ targetId: null, affectsMe: false });
    }
  });

  it('el Canciller ajeno avisa al terminar de elegir, no al jugarse', () => {
    const played = play(rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1] }), 6);
    expect(notices(played, 'p2')).toEqual([]);
    const done = step(played, {
      type: 'chancellor_keep',
      playerId: 'p0',
      keep: 2,
      bottomOrder: [7, 8],
    } as never);
    const [n] = notices(done, 'p2');
    expect(n?.body).toBe('Ana conservó una carta y dejó 2 cartas al fondo del mazo.');
    expect(n?.other).toMatchObject({ actorId: 'p0', card: 6, targetId: null, affectsMe: false });
  });

  it('Rey y Sacerdote como objetivo; un tercero no ve nada secreto', () => {
    const king = play(rig({ hands: [[7, 1], [3], [4]] }), 7, 'p1');
    const [k] = notices(king, 'p1');
    expect(k?.body).toContain('recibiste un Guardia');
    expect(k?.secretFaces).toContainEqual({ caption: 'Recibes', value: 1 });
    expect(k?.other?.affectsMe).toBe(true);
    const third = notices(king, 'p2')[0];
    expect(third?.secretFaces).toEqual([]);
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
