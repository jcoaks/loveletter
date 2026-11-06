import { describe, expect, it } from 'vitest';
import { act, play, rig } from './test-helpers';
import { viewFor } from './view';

describe('viewFor', () => {
  it('muestra solo la mano propia y datos públicos de los demás', () => {
    const s = rig({ hands: [[1, 5], [3], [7]], discards: { 1: [4] }, protect: [2] });
    const v = viewFor(s, 'p1');
    expect(v.you.hand).toEqual([3]);
    expect(v.players.map((p) => p.handSize)).toEqual([2, 1, 1]);
    expect(v.players[1]?.discards).toEqual([4]);
    expect(v.players[2]?.protected).toBe(true);
    expect(JSON.stringify(v)).not.toContain('"deck"');
    expect(v.deckSize).toBe(s.deck.length);
    expect(v.hasSetAside).toBe(true);
    expect(v.isMyTurn).toBe(false);
    expect(v.legalPlays).toEqual([]);
  });

  it('en tu turno da las jugadas legales con objetivos y acusaciones', () => {
    const s = rig({ hands: [[1, 5], [3], [], [2]], protect: [3] });
    const v = viewFor(s, 'p0');
    expect(v.isMyTurn).toBe(true);
    expect(v.awaiting).toEqual(['p0']);
    const guard = v.legalPlays.find((p) => p.card === 1);
    expect(guard).toMatchObject({
      playable: true,
      targetRule: 'other',
      targets: ['p1'],
      needsTarget: true,
      needsGuess: true,
    });
    expect(guard?.guesses).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
    const prince = v.legalPlays.find((p) => p.card === 5);
    expect(prince).toMatchObject({ targetRule: 'any', targets: ['p0', 'p1'], needsGuess: false });
  });

  it('deduplica cartas iguales en la mano', () => {
    const s = rig({ hands: [[1, 1], [3]] });
    expect(viewFor(s, 'p0').legalPlays).toHaveLength(1);
  });

  it('el Canciller solo se ofrece al jugador activo', () => {
    const s0 = rig({ hands: [[6, 2], [3], [4]], deck: [3, 4, 5] });
    const s = act(s0, play(s0, 'p0', 6));
    const mine = viewFor(s, 'p0');
    expect(mine.chancellor).toEqual({ hand: [2, 3, 4], keepOptions: [2, 3, 4], returnCount: 2 });
    expect(mine.legalPlays).toEqual([]);
    expect(viewFor(s, 'p1').chancellor).toBeNull();
    expect(viewFor(s, 'p1').players[0]?.handSize).toBe(3);
  });

  it('solo expone las partes privadas de cada evento a sus destinatarios', () => {
    const s0 = rig({ hands: [[2, 5], [3], [4]] });
    const s = act(s0, play(s0, 'p0', 2, 'p1'));
    const secretOf = (id: string) => viewFor(s, id).events.find((e) => e.type === 'priest')?.secret;
    expect(secretOf('p0')).toEqual({ to: ['p0'], hands: { p1: 3 } });
    expect(secretOf('p1')).toBeUndefined();
    expect(secretOf('p2')).toBeUndefined();
    const draw = (id: string) =>
      viewFor(s, id).events.find((e) => e.type === 'draw' && e.playerId === 'p1')?.secret;
    expect(draw('p1')).toBeDefined();
    expect(draw('p0')).toBeUndefined();
  });

  it('el Rey enseña a ambos lo que reciben y a nadie más', () => {
    const s0 = rig({ hands: [[7, 2], [5], [4]] });
    const s = act(s0, play(s0, 'p0', 7, 'p1'));
    const k = (id: string) => viewFor(s, id).events.find((e) => e.type === 'king')?.secret?.hands;
    expect(k('p0')).toEqual({ p0: 5, p1: 2 });
    expect(k('p1')).toEqual({ p0: 5, p1: 2 });
    expect(k('p2')).toBeUndefined();
  });

  it('muestra las cartas boca arriba en partidas de 2 y el resumen de ronda', () => {
    const s0 = rig({ hands: [[1, 5], [3]], faceUp: [0, 2, 4] });
    expect(viewFor(s0, 'p1').faceUp).toEqual([0, 2, 4]);
    const s = act(s0, play(s0, 'p0', 1, 'p1', 3));
    const v = viewFor(s, 'p1');
    expect(v.phase).toBe('round_over');
    expect(v.summary?.winnerIds).toEqual(['p0']);
    expect(v.roundOver).toEqual({ ready: [], waitingFor: ['p0', 'p1'], youReady: false });
    expect(v.awaiting).toEqual(['p0', 'p1']);
    expect(v.legalPlays).toEqual([]);
  });

  it('rechaza jugadores desconocidos', () => {
    expect(() => viewFor(rig({ hands: [[1, 5], [3]] }), 'nadie')).toThrow();
  });
});
