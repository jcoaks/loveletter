import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SeatData } from '../lib/seat';
import { TableLayout } from './TableLayout';
import { TurnBanner } from './TurnBanner';

const rivals = (n: number): SeatData[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `Rival ${i + 1}`,
    handCount: 1,
    discards: [],
    tokens: 0,
  }));

const table = (n: number) =>
  render(
    <TableLayout
      rivals={rivals(n)}
      toWin={3}
      deckCount={9}
      setAside={{ hidden: 1, faceUp: [] }}
      turn={<TurnBanner round={1} text="Es tu turno" toWin={3} mine />}
      mine={<span>mi mano</span>}
      log={['Empieza la ronda.']}
      onOpenGuide={() => undefined}
    />,
  );

describe('TableLayout', () => {
  it('1 rival: solo fila superior', () => {
    const { container } = table(1);
    expect(container.querySelector('.ll-table')).toHaveClass('few');
    expect(container.querySelectorAll('.ll-toprow .ll-seat')).toHaveLength(1);
    expect(container.querySelector('.left')).toBeNull();
  });

  it('2 rivales: uno a cada lado, sin fila superior', () => {
    const { container } = table(2);
    expect(container.querySelector('.ll-table')).toHaveClass('notop');
    expect(container.querySelector('.ll-toprow')).toBeNull();
    expect(container.querySelector('.left')).toHaveTextContent('Rival 1');
    expect(container.querySelector('.right')).toHaveTextContent('Rival 2');
  });

  it('4 rivales: laterales y dos arriba', () => {
    const { container } = table(4);
    expect(container.querySelector('.left')).toHaveTextContent('Rival 1');
    expect(container.querySelector('.right')).toHaveTextContent('Rival 4');
    expect(container.querySelectorAll('.ll-toprow .ll-seat')).toHaveLength(2);
  });

  it('5 rivales (6 jugadores): laterales y tres arriba, con mazo, apartada, registro y guía', () => {
    const { container } = table(5);
    expect(container.querySelectorAll('.ll-toprow .ll-seat')).toHaveLength(3);
    expect(container.querySelectorAll('.ll-seat')).toHaveLength(5);
    expect(screen.getByRole('img', { name: 'Mazo: 9 cartas' })).toBeInTheDocument();
    expect(screen.getByText('Apartada')).toBeInTheDocument();
    expect(screen.getByText('Empieza la ronda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carta guía: ampliar' })).toBeInTheDocument();
  });
});
