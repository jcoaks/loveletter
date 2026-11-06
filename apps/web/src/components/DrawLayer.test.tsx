import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrawLayer, type Flight } from './DrawLayer';
import { HandRow } from './HandRow';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});
const flight = (over: Partial<Flight> = {}): Flight => ({
  id: 'ev-1-0',
  playerId: 'p0',
  mine: false,
  from: rect(600, 200, 38, 53),
  to: rect(100, 120, 38, 53),
  delay: 0,
  duration: 0.05,
  ...over,
});

describe('DrawLayer', () => {
  it('es una capa en el body, sin clics y oculta a los lectores de pantalla', () => {
    render(<DrawLayer flights={[flight()]} onLand={() => undefined} />);
    const layer = document.querySelector('.ll-flights');
    expect(layer?.parentElement).toBe(document.body);
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer?.querySelectorAll('.ll-flyer')).toHaveLength(1);
  });

  it('el vuelo de un rival solo lleva el reverso: nunca una cara', () => {
    render(<DrawLayer flights={[flight()]} onLand={() => undefined} />);
    expect(document.querySelector('.ll-flyer .ll-card')).toBeNull();
    expect(document.querySelector('.ll-flyer-back')).not.toBeNull();
  });

  it('tu robo lleva la cara (con arte) para el volteo', () => {
    render(
      <DrawLayer
        flights={[flight({ mine: true, card: 7, to: rect(300, 400, 166, 232) })]}
        onLand={() => undefined}
      />,
    );
    const face = document.querySelector('.ll-flyer .ll-card');
    expect(face).not.toBeNull();
    expect(face).not.toHaveClass('sm');
    expect(face?.querySelector('img.art')).not.toBeNull();
  });

  it('avisa al aterrizar', async () => {
    const onLand = vi.fn();
    render(<DrawLayer flights={[flight()]} onLand={onLand} />);
    await waitFor(() => expect(onLand).toHaveBeenCalledOnce(), { timeout: 2000 });
  });
});

describe('HandRow con cartas en vuelo', () => {
  it('reserva el hueco de la última carta pero no la muestra', () => {
    const { container } = render(<HandRow hand={[4, 7]} hideLast={1} />);
    const cards = container.querySelectorAll('.ll-hand .ll-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).not.toHaveClass('ll-pending');
    expect(cards[1]).toHaveClass('ll-pending');
    expect(screen.getAllByRole('img').length).toBe(2);
  });
});
