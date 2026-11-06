import { describe, expect, it } from 'vitest';
import { applyAction, countCards, legalPlays } from './game';
import { seededRandom } from './random';
import type { CardValue } from './rules';
import { act, errorOf, eventsOf, play, rig } from './test-helpers';
import type { Action } from './types';

const keep = (playerId: string, k: CardValue, bottomOrder: CardValue[]): Action => ({
  type: 'chancellor_keep',
  playerId,
  keep: k,
  bottomOrder,
});

describe('validación de jugadas', () => {
  const s = rig({ hands: [[1, 5], [3], [2]] });

  it('solo juega el jugador activo y en la fase correcta', () => {
    expect(errorOf(s, play(s, 'p1', 3))).toBe('not_your_turn');
    expect(errorOf(s, keep('p0', 1, [5]))).toBe('wrong_phase');
    expect(errorOf(s, { type: 'continue_round', playerId: 'p0' })).toBe('wrong_phase');
    expect(errorOf(s, play(s, 'zzz', 1))).toBe('unknown_player');
  });

  it('exige que la carta esté en la mano', () => {
    expect(errorOf(s, play(s, 'p0', 9, 'p1', 2))).toBe('card_not_in_hand');
    expect(errorOf(s, play(s, 'p0', 99 as CardValue))).toBe('card_not_in_hand');
  });

  it('no muta el estado de entrada', () => {
    const before = JSON.stringify(s);
    act(s, play(s, 'p0', 1, 'p1', 3));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('valida objetivo y acusación del Guardia', () => {
    expect(errorOf(s, play(s, 'p0', 1))).toBe('invalid_target');
    expect(errorOf(s, play(s, 'p0', 1, 'p0', 2))).toBe('invalid_target');
    expect(errorOf(s, play(s, 'p0', 1, 'nadie', 2))).toBe('invalid_target');
    expect(errorOf(s, play(s, 'p0', 1, 'p1'))).toBe('invalid_guess');
    expect(errorOf(s, play(s, 'p0', 1, 'p1', 1))).toBe('invalid_guess');
    expect(errorOf(s, play(s, 'p0', 1, 'p1', 10 as CardValue))).toBe('invalid_guess');
    expect(errorOf(s, play(s, 'p0', 1, 'p1', 2.5 as CardValue))).toBe('invalid_guess');
    expect(errorOf(s, play(s, 'p0', 1, 'p1', 0))).toBeNull();
  });

  it('rechaza jugadores eliminados y protegidos', () => {
    const t = rig({ hands: [[1, 5], [3], [], [2]], protect: [1] });
    expect(errorOf(t, play(t, 'p0', 1, 'p1', 3))).toBe('target_protected');
    expect(errorOf(t, play(t, 'p0', 1, 'p2', 3))).toBe('invalid_target');
    expect(errorOf(t, play(t, 'p0', 1, 'p3', 3))).toBeNull();
  });

  it('un jugador eliminado no puede actuar', () => {
    const t = rig({ hands: [[1, 5], [], [2]] });
    expect(errorOf(t, play(t, 'p1', 1))).toBe('not_your_turn');
  });

  it('la partida terminada rechaza todo', () => {
    const t = rig({ hands: [[1, 5], [3]] });
    t.phase = 'game_over';
    expect(errorOf(t, play(t, 'p0', 1, 'p1', 3))).toBe('game_over');
  });
});

describe('Condesa forzada', () => {
  it('con el Rey hay que jugar la Condesa', () => {
    const s = rig({ hands: [[8, 7], [3], [2]] });
    expect(errorOf(s, play(s, 'p0', 7, 'p1'))).toBe('countess_forced');
    const next = act(s, play(s, 'p0', 8));
    expect(eventsOf(next, 'play')[0]).toMatchObject({ card: 8, forced: true });
  });

  it('con el Príncipe también', () => {
    const s = rig({ hands: [[5, 8], [3], [2]] });
    expect(errorOf(s, play(s, 'p0', 5, 'p1'))).toBe('countess_forced');
    expect(errorOf(s, play(s, 'p0', 8))).toBeNull();
  });

  it('con otras cartas la Condesa es opcional', () => {
    const s = rig({ hands: [[8, 1], [3], [2]] });
    expect(errorOf(s, play(s, 'p0', 1, 'p1', 3))).toBeNull();
    const plays = legalPlays(s, 'p0');
    expect(plays.every((p) => p.playable)).toBe(true);
  });

  it('legalPlays marca la carta bloqueada', () => {
    const s = rig({ hands: [[8, 7], [3], [2]] });
    const plays = legalPlays(s, 'p0');
    expect(plays.find((p) => p.card === 7)).toMatchObject({
      playable: false,
      blockedBy: 'countess',
    });
    expect(plays.find((p) => p.card === 8)).toMatchObject({ playable: true, blockedBy: null });
  });
});

describe('Espía', () => {
  it('no tiene efecto y queda anotado', () => {
    const s0 = rig({ hands: [[0, 4], [3], [2]] });
    const s = act(s0, play(s0, 'p0', 0));
    expect(s.spyPlayed).toEqual(['p0']);
    expect(s.discards.p0).toEqual([0]);
    expect(s.activeId).toBe('p1');
  });
});

describe('Guardia', () => {
  it('elimina si acierta', () => {
    const s0 = rig({ hands: [[1, 5], [3], [2]] });
    const s = act(s0, play(s0, 'p0', 1, 'p1', 3));
    expect(s.eliminated).toEqual(['p1']);
    expect(s.discards.p1).toEqual([3]);
    expect(s.hands.p1).toEqual([]);
    expect(s.activeId).toBe('p2');
  });

  it('no pasa nada si falla', () => {
    const s0 = rig({ hands: [[1, 5], [3], [2]] });
    const s = act(s0, play(s0, 'p0', 1, 'p1', 4));
    expect(s.eliminated).toEqual([]);
    expect(eventsOf(s, 'guess')[0]).toMatchObject({ correct: false });
  });

  it('puede nombrar el Espía (0)', () => {
    const s0 = rig({ hands: [[1, 5], [0], [2]] });
    const s = act(s0, play(s0, 'p0', 1, 'p1', 0));
    expect(s.eliminated).toEqual(['p1']);
    // Eliminado con un Espía en mano: no cuenta como Espía jugado.
    expect(s.spyPlayed).toEqual([]);
  });

  it('sin objetivos legales se juega sin efecto', () => {
    const s0 = rig({ hands: [[1, 5], [3], [2]], protect: [1, 2] });
    expect(legalPlays(s0, 'p0').find((p) => p.card === 1)).toMatchObject({
      needsTarget: false,
      needsGuess: false,
      targets: [],
    });
    const s = act(s0, play(s0, 'p0', 1));
    expect(eventsOf(s, 'no_effect')[0]).toMatchObject({ reason: 'no_targets' });
    expect(s.activeId).toBe('p1');
    expect(s.protectedIds).toEqual(['p2']); // la protección de p1 terminó al llegar su turno
  });
});

describe('Sacerdote', () => {
  it('solo quien lo juega ve la carta', () => {
    const s0 = rig({ hands: [[2, 5], [3], [4]] });
    const s = act(s0, play(s0, 'p0', 2, 'p1'));
    const e = eventsOf(s, 'priest')[0];
    expect(e?.secret).toEqual({ to: ['p0'], hands: { p1: 3 } });
  });
});

describe('Barón', () => {
  it('elimina al de menor valor (el rival)', () => {
    const s0 = rig({ hands: [[3, 5], [2], [4]] });
    const s = act(s0, play(s0, 'p0', 3, 'p1'));
    expect(s.eliminated).toEqual(['p1']);
    expect(eventsOf(s, 'baron')[0]).toMatchObject({ loserId: 'p1', loserCard: 2 });
  });

  it('elimina al jugador si pierde él', () => {
    const s0 = rig({ hands: [[3, 1], [7], [4]] });
    const s = act(s0, play(s0, 'p0', 3, 'p1'));
    expect(s.eliminated).toEqual(['p0']);
    expect(s.discards.p0).toEqual([3, 1]);
    expect(eventsOf(s, 'baron')[0]?.secret?.to).toEqual(['p0', 'p1']);
  });

  it('en empate no cae nadie', () => {
    const s0 = rig({ hands: [[3, 5], [5], [4]] });
    const s = act(s0, play(s0, 'p0', 3, 'p1'));
    expect(s.eliminated).toEqual([]);
    expect(eventsOf(s, 'baron')[0]).toMatchObject({ loserId: null, loserCard: null });
  });
});

describe('Doncella', () => {
  it('protege hasta su próximo turno', () => {
    const s0 = rig({ hands: [[4, 5], [1], [2]], deck: [3, 3, 3, 3, 3] });
    const s1 = act(s0, play(s0, 'p0', 4));
    expect(s1.protectedIds).toEqual(['p0']);
    // p1 (con Guardia + carta robada) no puede elegirla.
    expect(errorOf(s1, play(s1, 'p1', 1, 'p0', 5))).toBe('target_protected');
    expect(legalPlays(s1, 'p1').find((p) => p.card === 1)?.targets).toEqual(['p2']);
    const s2 = act(s1, play(s1, 'p1', 1, 'p2', 5));
    const s3 = act(s2, play(s2, 'p2', 2, 'p1'));
    // al llegar su turno, p0 deja de estar protegida
    expect(s3.activeId).toBe('p0');
    expect(s3.protectedIds).toEqual([]);
  });
});

describe('Príncipe', () => {
  it('hace descartar a otro SIN aplicar el efecto, y roba', () => {
    const s0 = rig({ hands: [[5, 2], [1], [3]], deck: [6, 6, 6] });
    const s = act(s0, play(s0, 'p0', 5, 'p1'));
    expect(s.discards.p1).toEqual([1]);
    expect(s.hands.p1?.[0]).toBe(6); // robó una carta nueva (y luego la de su turno)
    expect(s.eliminated).toEqual([]);
  });

  it('puede elegirse a sí mismo', () => {
    const s0 = rig({ hands: [[5, 2], [1], [3]], deck: [6, 6, 6] });
    expect(legalPlays(s0, 'p0').find((p) => p.card === 5)?.targets).toContain('p0');
    const s = act(s0, play(s0, 'p0', 5, 'p0'));
    expect(s.discards.p0).toEqual([5, 2]);
    expect(s.hands.p0).toEqual([6]);
  });

  it('la Princesa descartada elimina (a otro y a uno mismo)', () => {
    const s0 = rig({ hands: [[5, 2], [9], [3]] });
    const s = act(s0, play(s0, 'p0', 5, 'p1'));
    expect(s.eliminated).toEqual(['p1']);
    expect(s.discards.p1).toEqual([9]);
    expect(eventsOf(s, 'eliminated')[0]).toMatchObject({ cause: 'prince_princess', card: 9 });
    const t0 = rig({ hands: [[5, 9], [1], [3]] });
    const t = act(t0, play(t0, 'p0', 5, 'p0'));
    expect(t.eliminated).toEqual(['p0']);
  });

  it('no puede apuntar a un protegido, pero a sí mismo siempre', () => {
    const s0 = rig({ hands: [[5, 2], [1], [3]], protect: [1, 2] });
    expect(legalPlays(s0, 'p0').find((p) => p.card === 5)?.targets).toEqual(['p0']);
  });

  it('con el mazo vacío el objetivo roba la carta apartada', () => {
    const s0 = rig({ hands: [[5, 2], [1], [3]], deck: [], setAside: 7 });
    const s = act(s0, play(s0, 'p0', 5, 'p1'));
    expect(s.hands.p1).toEqual([7]);
    expect(s.setAside).toBeNull();
    expect(eventsOf(s, 'draw')[0]).toMatchObject({ from: 'set_aside', reason: 'prince' });
    expect(s.phase).toBe('round_over'); // mazo vacío: se acaba la ronda
  });

  it('descartar un Espía cuenta como Espía descartado', () => {
    const s0 = rig({ hands: [[5, 2], [0], [3]], deck: [6, 6, 6] });
    const s = act(s0, play(s0, 'p0', 5, 'p1'));
    expect(s.spyPlayed).toEqual(['p1']);
  });
});

describe('Canciller', () => {
  const draw = (deck: CardValue[]) => {
    const s0 = rig({ hands: [[6, 2], [3], [4]], deck });
    return { s0, s: act(s0, play(s0, 'p0', 6)) };
  };

  it('roba 2, conserva 1 y pone 2 al fondo en el orden elegido', () => {
    const { s } = draw([3, 4, 5, 7]);
    expect(s.phase).toBe('chancellor');
    expect(s.hands.p0).toEqual([2, 3, 4]);
    expect(s.deck).toEqual([5, 7]);
    expect(eventsOf(s, 'chancellor')[0]?.secret).toEqual({ to: ['p0'], drawn: [3, 4] });
    const t = act(s, keep('p0', 4, [3, 2]));
    expect(t.hands.p0).toEqual([4]);
    expect(t.deck.slice(-2)).toEqual([3, 2]);
    expect(t.phase).toBe('turn');
    expect(t.activeId).toBe('p1');
  });

  it('con 1 carta en el mazo roba 1 y devuelve 1', () => {
    const { s } = draw([5]);
    expect(s.hands.p0).toEqual([2, 5]);
    expect(s.deck).toEqual([]);
    const t = act(s, keep('p0', 5, [2]));
    expect(t.phase).toBe('turn'); // el mazo no estaba vacío al cerrar el turno
    expect(t.hands.p1).toContain(2); // p1 roba la carta devuelta
  });

  it('con el mazo vacío no tiene efecto', () => {
    const { s } = draw([]);
    expect(s.phase).toBe('round_over');
    expect(eventsOf(s, 'no_effect')[0]).toMatchObject({ reason: 'empty_deck' });
  });

  it('valida la elección', () => {
    const { s } = draw([3, 4, 5]);
    expect(errorOf(s, keep('p0', 9, [2, 3]))).toBe('invalid_chancellor_choice');
    expect(errorOf(s, keep('p0', 4, [2]))).toBe('invalid_chancellor_choice');
    expect(errorOf(s, keep('p0', 4, [2, 2]))).toBe('invalid_chancellor_choice');
    expect(errorOf(s, keep('p0', 4, [4, 3]))).toBe('invalid_chancellor_choice');
    expect(errorOf(s, keep('p1', 3, [2, 4]))).toBe('not_your_turn');
    expect(errorOf(s, play(s, 'p0', 2))).toBe('wrong_phase');
    expect(errorOf(s, keep('p0', 2, [4, 3]))).toBeNull();
  });

  it('admite cartas repetidas en la elección', () => {
    const s0 = rig({ hands: [[6, 1], [3], [4]], deck: [1, 1, 5] });
    const s = act(s0, play(s0, 'p0', 6));
    expect(errorOf(s, keep('p0', 1, [1, 1]))).toBeNull();
  });
});

describe('Rey', () => {
  it('intercambia las manos y ambos ven la carta que reciben', () => {
    const s0 = rig({ hands: [[7, 2], [5], [4]] });
    const s = act(s0, play(s0, 'p0', 7, 'p1'));
    expect(s.hands.p0).toEqual([5]);
    expect(s.hands.p1?.[0]).toBe(2);
    expect(eventsOf(s, 'king')[0]?.secret).toEqual({ to: ['p0', 'p1'], hands: { p0: 5, p1: 2 } });
  });
});

describe('Princesa y Condesa', () => {
  it('jugar la Princesa elimina', () => {
    const s0 = rig({ hands: [[9, 2], [5], [4]] });
    const s = act(s0, play(s0, 'p0', 9));
    expect(s.eliminated).toEqual(['p0']);
    expect(s.discards.p0).toEqual([9, 2]);
  });
});

describe('fin de ronda', () => {
  it('última superviviente', () => {
    const s0 = rig({ hands: [[1, 5], [3]] });
    const s = act(s0, play(s0, 'p0', 1, 'p1', 3));
    expect(s.phase).toBe('round_over');
    expect(s.summary).toMatchObject({
      reason: 'last_standing',
      winnerIds: ['p0'],
      revealedHands: null,
    });
    expect(s.tokens.p0).toBe(1);
  });

  it('mazo vacío: gana la mano más alta y se revelan las manos', () => {
    const s0 = rig({ hands: [[4, 5], [3], [7]], deck: [] });
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.summary).toMatchObject({
      reason: 'highest_hand',
      winnerIds: ['p2'],
      revealedHands: { p0: 5, p1: 3, p2: 7 },
      discardTotals: null,
    });
  });

  it('desempate por suma de descartes', () => {
    const s0 = rig({ hands: [[2, 5], [5], [3]], deck: [], discards: { 0: [1], 1: [6, 4] } });
    const s = act(s0, play(s0, 'p0', 2, 'p1'));
    expect(s.summary).toMatchObject({
      reason: 'discard_tiebreak',
      winnerIds: ['p1'],
      discardTotals: { p0: 3, p1: 10 },
    });
  });

  it('si persiste el empate ganan todos', () => {
    const s0 = rig({ hands: [[2, 5], [5], [3]], deck: [], discards: { 0: [1, 2], 1: [3] } });
    const s = act(s0, play(s0, 'p0', 2, 'p1'));
    // p0 tras jugar 2: descartes [1,2,2]=5 ; p1 [3]=3 -> gana p0. Ajuste: igualar.
    expect(s.summary?.winnerIds).toEqual(['p0']);
    const t0 = rig({ hands: [[2, 5], [5], [3]], deck: [], discards: { 0: [1, 1], 1: [4] } });
    const t = act(t0, play(t0, 'p0', 2, 'p1'));
    // p0: 1+1+2 = 4, p1: 4 -> empate total
    expect(t.summary).toMatchObject({ reason: 'shared_tie', winnerIds: ['p0', 'p1'] });
    expect(t.tokens).toMatchObject({ p0: 1, p1: 1, p2: 0 });
  });

  it('el eliminado no entra en la comparación', () => {
    const s0 = rig({ hands: [[2, 3], [], [4]], deck: [] });
    const s = act(s0, play(s0, 'p0', 2, 'p2'));
    expect(s.summary).toMatchObject({ winnerIds: ['p2'] });
  });
});

describe('bonificación del Espía', () => {
  const spyRound = (spy: number[], hands: CardValue[][], active = 0) => {
    const s0 = rig({ hands, deck: [], spy, active });
    return s0;
  };

  it('un único superviviente con Espía gana 1 ficha extra', () => {
    const s0 = spyRound([0], [[4, 5], [3], [7]]);
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.summary).toMatchObject({ winnerIds: ['p2'], spyBonusId: 'p0' });
    expect(s.tokens).toMatchObject({ p0: 1, p2: 1 });
  });

  it('el ganador con Espía recibe 2 fichas', () => {
    const s0 = spyRound([2], [[4, 5], [3], [7]]);
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.tokens.p2).toBe(2);
  });

  it('si dos supervivientes jugaron Espía, nadie', () => {
    const s0 = spyRound([0, 1], [[4, 5], [3], [7]]);
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.summary?.spyBonusId).toBeNull();
  });

  it('2 jugadores: un Espía da bonificación; dos, no', () => {
    const a0 = rig({ hands: [[0, 5], [3]], deck: [], spy: [] });
    const a = act(a0, play(a0, 'p0', 0));
    expect(a.summary).toMatchObject({ winnerIds: ['p0'], spyBonusId: 'p0' });
    expect(a.tokens.p0).toBe(2);
    const b0 = rig({ hands: [[0, 5], [3]], deck: [], spy: [1] });
    const b = act(b0, play(b0, 'p0', 0));
    expect(b.summary?.spyBonusId).toBeNull();
    expect(b.tokens.p0).toBe(1);
  });

  it('el eliminado que jugó Espía no cuenta', () => {
    // p1 jugó Espía antes y cae; p0 (sin Espía) gana: sin bonificación.
    const s0 = rig({ hands: [[1, 5], [3]], spy: [1] });
    const s = act(s0, play(s0, 'p0', 1, 'p1', 3));
    expect(s.summary?.spyBonusId).toBeNull();
    // y el superviviente con Espía la cobra aunque otro eliminado también.
    const t0 = rig({ hands: [[1, 5], [3]], spy: [0, 1] });
    const t = act(t0, play(t0, 'p0', 1, 'p1', 3));
    expect(t.summary).toMatchObject({ spyBonusId: 'p0', winnerIds: ['p0'] });
    expect(t.tokens.p0).toBe(2);
  });

  it('jugar el Espía como última carta antes de ganar por Guardia', () => {
    const s0 = rig({ hands: [[0, 1], [3]] });
    const s1 = act(s0, play(s0, 'p0', 0));
    expect(s1.spyPlayed).toEqual(['p0']);
  });
});

describe('metas de fichas y fin de partida', () => {
  it.each([
    [2, 6],
    [3, 5],
    [4, 4],
    [5, 3],
    [6, 3],
  ])('%i jugadores: meta %i', (n, goal) => {
    const hands: CardValue[][] = Array.from({ length: n }, () => [3]);
    hands[0] = [1, 5];
    const s0 = rig({ hands });
    expect(s0.tokensToWin).toBe(goal);
  });

  const finishing = (tokens: number[], spy: number[] = []) =>
    rig({ hands: [[4, 5], [3], [7]], deck: [], tokens, spy });

  it('el primero en la meta gana la partida', () => {
    const s0 = finishing([0, 0, 4]); // meta 5
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.phase).toBe('game_over');
    expect(s.winnerIds).toEqual(['p2']);
    expect(s.summary?.gameWinnerIds).toEqual(['p2']);
    expect(errorOf(s, { type: 'continue_round', playerId: 'p0' })).toBe('game_over');
  });

  it('si dos llegan a la vez con las mismas fichas, ganan ambos', () => {
    const s0 = finishing([4, 0, 4], [0]);
    const s = act(s0, play(s0, 'p0', 4));
    // p0: 4 + bonificación del Espía = 5; p2: 4 + victoria = 5
    expect(s.winnerIds).toEqual(['p0', 'p2']);
  });

  it('si dos llegan a la vez, gana quien tenga más fichas', () => {
    // Empate de ronda entre p0 y p2 (mano 5 y descartes 4 cada uno); p0 además cobra el Espía.
    const s0 = rig({
      hands: [[4, 5], [3], [5]],
      deck: [],
      tokens: [4, 0, 4],
      spy: [0],
      discards: { 0: [0], 2: [4] },
    });
    const s = act(s0, play(s0, 'p0', 4));
    expect(s.summary?.reason).toBe('shared_tie');
    expect(s.tokens).toMatchObject({ p0: 6, p2: 5 });
    expect(s.winnerIds).toEqual(['p0']);
  });
});

describe('siguiente ronda', () => {
  const ended = () => {
    const s0 = rig({ hands: [[4, 5], [3], [7]], deck: [], bots: 1 });
    return act(s0, play(s0, 'p0', 4));
  };

  it('los bots se confirman solos y los humanos deben continuar', () => {
    const s = ended();
    expect(s.phase).toBe('round_over');
    expect(s.ready).toEqual(['p2']);
    const a = act(s, { type: 'continue_round', playerId: 'p0' });
    expect(a.phase).toBe('round_over');
    const a2 = act(a, { type: 'continue_round', playerId: 'p0' }); // idempotente
    expect(a2.ready).toEqual(a.ready);
    const b = act(a, { type: 'continue_round', playerId: 'p1' });
    expect(b.phase).toBe('turn');
    expect(b.round).toBe(2);
    expect(countCards(b)).toBe(21);
  });

  it('empieza la ganadora anterior y las fichas persisten', () => {
    const s = ended();
    const a = act(act(s, { type: 'continue_round', playerId: 'p0' }), {
      type: 'continue_round',
      playerId: 'p1',
    });
    expect(a.activeId).toBe('p2');
    expect(a.tokens.p2).toBe(1);
    expect(a.eliminated).toEqual([]);
    expect(a.protectedIds).toEqual([]);
    expect(a.summary).toBeNull();
    expect(a.history).toHaveLength(1);
  });

  it('con varias ganadoras empieza la de menor asiento', () => {
    const s0 = rig({ hands: [[2, 5], [5], [3]], deck: [], discards: { 0: [1, 1], 1: [4] } });
    const s = act(s0, play(s0, 'p0', 2, 'p1'));
    expect(s.nextStarterId).toBe('p0');
  });
});

describe('aleatoriedad inyectada', () => {
  it('con la misma semilla se obtiene el mismo reparto', () => {
    const s0 = rig({ hands: [[4, 5], [3]], deck: [], bots: 2 });
    const s = act(s0, play(s0, 'p0', 4));
    const a = applyAction(s, { type: 'continue_round', playerId: 'p0' }, seededRandom(5));
    const b = applyAction(s, { type: 'continue_round', playerId: 'p0' }, seededRandom(5));
    expect(a).toEqual(b);
  });
});
