import { type CardValue, type GameState, type PlayerView, viewFor } from '@loveletter/engine';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TURN_DRAW_DELAY_MS } from '../lib/draws';
import { rig, step } from '../test-utils';
import { useDraws } from './useDraws';

const play = (s: GameState, card: CardValue, targetId?: string) =>
  step(s, { type: 'play_card', playerId: s.activeId as string, card, targetId });

/** Un tablero mínimo con tamaño, para que haya a dónde volar (jsdom no calcula posiciones). */
function fixture() {
  const backs = '<span class="ll-back"></span>'.repeat(3);
  document.body.innerHTML = `
    <div class="ll-stack"></div>
    ${['p0', 'p1', 'p2'].map((id) => `<div data-seat-id="${id}"><span class="ll-backs">${backs}</span></div>`).join('')}
    <div class="ll-hand"><span class="ll-card"></span><span class="ll-card"></span></div>`;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        left: 100,
        top: 100,
        width: 40,
        height: 56,
        right: 140,
        bottom: 156,
        x: 100,
        y: 100,
      }) as DOMRect,
  );
}

function mount(before: PlayerView) {
  return renderHook(({ game }) => useDraws(game, false), { initialProps: { game: before } });
}

const settle = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('useDraws: pausa antes del robo de inicio de turno', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    fixture();
  });
  afterEach(() => {
    // @ts-expect-error jsdom no define matchMedia: se restablece
    window.matchMedia = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('el vuelo del robo de turno espera 1 s tras quedar listo para salir; el hueco sigue reservado', async () => {
    const before = rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] });
    const after = play(before, 4);
    const { result, rerender } = mount(viewFor(before, 'p2'));
    rerender({ game: viewFor(after, 'p2') });
    // Reservado y oculto desde que llega la vista.
    expect(result.current.pending.p1).toBe(1);
    await settle(100);
    // El vuelo ya está en la capa, pero sale con 1 s de espera (el hueco sigue oculto).
    expect(result.current.flights).toHaveLength(1);
    expect(result.current.flights[0]?.delay).toBeCloseTo(TURN_DRAW_DELAY_MS / 1000, 5);
    expect(result.current.pending.p1).toBe(1);
  });

  it('no afecta al robo del Príncipe, que sale enseguida (solo el de turno que le sigue espera)', async () => {
    const before = rig({ hands: [[5, 2], [3], [4]], deck: [8, 1, 1, 1] });
    const after = play(before, 5, 'p1');
    const { result, rerender } = mount(viewFor(before, 'p2'));
    rerender({ game: viewFor(after, 'p2') });
    await settle(100);
    const delays = result.current.flights.map((f) => f.delay);
    expect(delays).toHaveLength(2);
    // El del Príncipe: sin pausa extra. El de inicio de turno: pausa de 1 s además de la tanda.
    expect(delays[0]).toBeLessThan(TURN_DRAW_DELAY_MS / 1000);
    expect(delays[1]).toBeGreaterThanOrEqual(TURN_DRAW_DELAY_MS / 1000);
  });

  it('no afecta al Canciller', async () => {
    const start = rig({ hands: [[6, 2], [3], [4]], deck: [7, 8, 1, 1] });
    const { result, rerender } = mount(viewFor(start, 'p1'));
    rerender({ game: viewFor(play(start, 6), 'p1') });
    await settle(100);
    expect(result.current.flights).toHaveLength(2);
    expect(result.current.flights.every((f) => f.delay < TURN_DRAW_DELAY_MS / 1000)).toBe(true);
  });

  it('reconexión: sin sucesos nuevos no hay espera ni vuelos', async () => {
    const before = rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] });
    const after = play(before, 4);
    const { result } = mount(viewFor(after, 'p2'));
    await settle(200);
    expect(result.current.flights).toEqual([]);
    expect(result.current.pending).toEqual({});
  });

  it('movimiento reducido: sin vuelo, pero la carta tampoco aparece antes de 1 s', async () => {
    window.matchMedia = ((q: string) =>
      ({
        matches: q.includes('reduce'),
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    const before = rig({ hands: [[4, 2], [3], [5]], deck: [7, 1, 1] });
    const after = play(before, 4);
    const { result, rerender } = mount(viewFor(before, 'p2'));
    rerender({ game: viewFor(after, 'p2') });
    expect(result.current.flights).toEqual([]);
    expect(result.current.pending.p1).toBe(1);
    await settle(TURN_DRAW_DELAY_MS - 50);
    expect(result.current.pending.p1).toBe(1);
    await settle(100);
    expect(result.current.pending.p1).toBeUndefined();
  });
});
