import { type CardValue, type PlayerView, type RoundSummary, viewFor } from '@loveletter/engine';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { roundVerdict } from '../../lib/chronicle';
import { rig, step } from '../../test-utils';
import { RoundOverModal } from './RoundOver';

afterEach(cleanup);

const play = (s: ReturnType<typeof rig>, card: CardValue, targetId?: string, guess?: CardValue) =>
  step(s, { type: 'play_card', playerId: 'p0', card, targetId, guess });

const modes = {
  last_standing: () => play(rig({ hands: [[1, 2], [3]] }), 1, 'p1', 3),
  highest_hand: () => play(rig({ hands: [[2, 3], [5]], deck: [] }), 2, 'p1'),
  discard_tiebreak: () => play(rig({ hands: [[2, 5], [5]], deck: [] }), 2, 'p1'),
  shared_tie: () => play(rig({ hands: [[2, 5], [5]], deck: [], discards: { 1: [2] } }), 2, 'p1'),
} as const;

function show(view: PlayerView) {
  render(<RoundOverModal game={view} onContinue={() => undefined} onHide={() => undefined} />);
  return within(screen.getByRole('dialog'));
}

const verdicts: Record<keyof typeof modes, [string, string, string]> = {
  // [título visto por p0, motivo visto por p0, motivo visto por p1]
  last_standing: ['Ganaste la ronda', 'Fuiste el último jugador en pie.', 'Beto: no es el caso'],
  highest_hand: [
    'Gana la ronda Beto',
    'Se acabó el mazo y Beto tenía la mano más alta.',
    'Se acabó el mazo y tenías la mano más alta.',
  ],
  discard_tiebreak: [
    'Ganaste la ronda',
    'Empataste en la mano más alta y ganaste por la mayor suma de descartes.',
    'Ana empató en la mano más alta y ganó por la mayor suma de descartes.',
  ],
  shared_tie: [
    'Empate: tú y Beto ganan la ronda',
    'Empate total: ganan todos los empatados.',
    'Empate total: ganan todos los empatados.',
  ],
};

describe('Resumen de ronda: carta apartada y gramática', () => {
  it.each(Object.keys(modes) as (keyof typeof modes)[])(
    '%s: carta pequeña al final, en una línea',
    (mode) => {
      const state = modes[mode]();
      expect(state.phase).toBe('round_over');
      expect(state.summary?.reason).toBe(mode);
      const view = viewFor(state, 'p0');
      expect(view.summary?.setAside).toBeDefined();
      const d = show(view);
      const section = d.getByRole('region', { name: 'Carta apartada' });
      const card = within(section).getByRole('img', { name: /^Carta apartada: / });
      // Discreta: miniatura, texto corto y sin título grande ni explicación.
      expect(card).toHaveClass('sm');
      expect(within(section).getByText(/^Carta apartada: /)).toBeInTheDocument();
      expect(d.queryByRole('heading', { name: 'Carta apartada' })).toBeNull();
      expect(d.queryByText(/boca abajo al empezar/)).toBeNull();
      // Es lo último del resumen: después de la tabla de fichas.
      const body = section.parentElement as HTMLElement;
      expect(body.lastElementChild).toBe(section);
    },
  );

  it.each(Object.keys(modes) as (keyof typeof modes)[])(
    '%s: título y motivo en segunda persona cuando ganas tú',
    (mode) => {
      if (mode === 'last_standing') {
        const d = show(viewFor(modes[mode](), 'p0'));
        expect(d.getByRole('heading', { name: verdicts[mode][0] })).toBeInTheDocument();
        expect(d.getByText(verdicts[mode][1])).toBeInTheDocument();
        expect(d.queryByText(/Tú:/)).toBeNull();
        return;
      }
      const asP0 = show(viewFor(modes[mode](), 'p0'));
      expect(asP0.getByRole('heading', { name: verdicts[mode][0] })).toBeInTheDocument();
      expect(asP0.getByText(verdicts[mode][1])).toBeInTheDocument();
      cleanup();
      const asP1 = show(viewFor(modes[mode](), 'p1'));
      expect(asP1.getByText(verdicts[mode][2])).toBeInTheDocument();
    },
  );

  it('la bonificación del Espía en primera y tercera persona', () => {
    const base = viewFor(modes.last_standing(), 'p0').summary as RoundSummary;
    const ctx = (me: string) => ({ me, name: (id: string) => (id === 'p0' ? 'Ana' : 'Beto') });
    const sum = { ...base, spyBonusId: 'p0' } as RoundSummary;
    expect(roundVerdict(sum, ctx('p0')).bonus).toBe('Ganas 1 ficha extra por el Espía.');
    expect(roundVerdict(sum, ctx('p1')).bonus).toBe('Ana gana 1 ficha extra por el Espía.');
    expect(roundVerdict({ ...base, spyBonusId: null }, ctx('p0')).bonus).toBeNull();
  });

  it('al pasar el cursor o enfocar se amplía (sin ocupar sitio por defecto)', () => {
    const d = show(viewFor(modes.last_standing(), 'p0'));
    const aside = d.getByRole('button', { name: /^Carta apartada: / });
    expect(aside.querySelector('.ll-aside-pop')).not.toBeNull();
  });

  it('no muestra nada si el estado guardado no la trae (salas anteriores)', () => {
    const view = viewFor(modes.last_standing(), 'p0');
    const summary = { ...view.summary, setAside: undefined } as unknown as PlayerView['summary'];
    const old: PlayerView = { ...view, summary };
    const d = show(old);
    expect(d.queryByRole('region', { name: 'Carta apartada' })).toBeNull();
    expect(d.queryByText(/Carta apartada/)).toBeNull();
  });
});
