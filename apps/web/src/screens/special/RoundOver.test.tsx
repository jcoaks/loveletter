import { type CardValue, type PlayerView, viewFor } from '@loveletter/engine';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('Resumen de ronda: carta apartada', () => {
  it.each(Object.keys(modes) as (keyof typeof modes)[])(
    '%s: la muestra grande con su título',
    (mode) => {
      const state = modes[mode]();
      expect(state.phase).toBe('round_over');
      expect(state.summary?.reason).toBe(mode);
      const view = viewFor(state, 'p0');
      const aside = view.summary?.setAside;
      expect(aside).toBeDefined();
      const d = show(view);
      const section = d.getByRole('region', { name: 'Carta apartada' });
      expect(within(section).getByRole('heading', { name: 'Carta apartada' })).toBeInTheDocument();
      expect(
        within(section).getByText('La que se apartó boca abajo al empezar la ronda'),
      ).toBeInTheDocument();
      const card = within(section).getByRole('img', { name: /^Carta apartada: / });
      // Tamaño grande, nunca la miniatura.
      expect(card).not.toHaveClass('sm');
      expect(card.closest('.ll-flip')).not.toBeNull();
    },
  );

  it('no muestra nada si el estado guardado no la trae (salas anteriores)', () => {
    const view = viewFor(modes.last_standing(), 'p0');
    const summary = { ...view.summary, setAside: undefined } as unknown as PlayerView['summary'];
    const old: PlayerView = { ...view, summary };
    const d = show(old);
    expect(d.queryByRole('region', { name: 'Carta apartada' })).toBeNull();
    expect(d.queryByText('Carta apartada')).toBeNull();
  });
});
