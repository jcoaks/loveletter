import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Card } from './Card';
import { HandRow } from './HandRow';

describe('Card', () => {
  it('describe la carta grande con valor, nombre y efecto', () => {
    render(<Card value={1} />);
    expect(
      screen.getByRole('img', { name: '1, Guardia. Adivina la carta de otro jugador.' }),
    ).toBeInTheDocument();
  });

  it('la carta pequeña usa solo el nombre', () => {
    render(<Card value={4} size="sm" />);
    expect(screen.getByRole('img', { name: 'Doncella' })).toBeInTheDocument();
  });

  it('es un botón conmutable y avisa al pulsar', async () => {
    const onClick = vi.fn();
    render(<Card value={7} selected onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Rey/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('el bloqueo por Condesa se anuncia', () => {
    render(<Card value={5} locked onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: /Bloqueada por la Condesa\./ })).toBeInTheDocument();
  });

  it('HandRow bloquea Rey y Príncipe solo con la Condesa en la mano', () => {
    const { rerender } = render(<HandRow hand={[7, 8]} onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: /Rey.*Bloqueada/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^8, Condesa/ })).not.toHaveAccessibleName(
      /Bloqueada/,
    );
    rerender(<HandRow hand={[7, 3]} onSelect={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Bloqueada/ })).not.toBeInTheDocument();
  });

  it('HandRow vacío avisa que quedaste fuera', () => {
    render(<HandRow hand={[]} />);
    expect(screen.getByText(/quedaste fuera/)).toBeInTheDocument();
  });
});
