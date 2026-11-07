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

const table = (n: number, deckCount = 9) =>
  render(
    <TableLayout
      rivals={rivals(n)}
      toWin={3}
      deckCount={deckCount}
      setAside={{ hidden: 1, faceUp: [] }}
      turn={<TurnBanner round={1} text="Es tu turno" toWin={3} mine />}
      mine={<span>mi mano</span>}
      actions={<button type="button">Jugar</button>}
      log={['Empieza la ronda.']}
      onOpenGuide={() => undefined}
    />,
  );

describe('Mazo: asentamiento al meterse una carta al fondo', () => {
  it('la pila lleva la clase de asentamiento solo tras recibir una carta', () => {
    const { container, rerender } = render(
      <TableLayout
        rivals={[]}
        toWin={3}
        deckCount={5}
        setAside={{ hidden: 1, faceUp: [] }}
        turn={<span>t</span>}
        mine={<span>m</span>}
      />,
    );
    expect(container.querySelector('.ll-stack')).not.toHaveClass('nudge');
    rerender(
      <TableLayout
        rivals={[]}
        toWin={3}
        deckCount={6}
        deckNudge={1}
        setAside={{ hidden: 1, faceUp: [] }}
        turn={<span>t</span>}
        mine={<span>m</span>}
      />,
    );
    expect(container.querySelector('.ll-stack')).toHaveClass('nudge');
  });
});

describe('TableLayout', () => {
  it.each([1, 2, 4, 5])('%i rivales en una sola fila compacta', (n) => {
    const { container } = table(n);
    expect(container.querySelector('.ll-rivals')).toHaveAttribute('data-count', String(n));
    expect(container.querySelectorAll('.ll-rivals .ll-seat')).toHaveLength(n);
  });

  it('con mazo, apartada, mano, barra de acciones, registro opcional y guía', () => {
    table(5);
    expect(screen.getByRole('img', { name: 'Mazo: 9 cartas' })).toBeInTheDocument();
    expect(screen.getByText('Apartada')).toBeInTheDocument();
    expect(screen.getByText('mi mano')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeInTheDocument();
    expect(screen.getByText('Empieza la ronda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carta guía: ampliar' })).toBeInTheDocument();
  });

  it.each([
    [20, 3],
    [3, 3],
    [2, 2],
    [1, 1],
    [0, 0],
  ])('mazo de %i cartas dibuja %i reversos', (count, layers) => {
    const { container } = table(1, count);
    const stack = container.querySelector('.ll-stack');
    expect(stack?.querySelectorAll('.ll-back')).toHaveLength(layers);
    expect(stack?.classList.contains('empty')).toBe(layers === 0);
    expect(stack?.querySelector('em')).toHaveTextContent(String(count));
  });
});
