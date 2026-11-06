import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const { secondsLeft, paused, pointer } = useCountdown({ ms: 3000, resetKey: 'a', onDone, root });
  return (
    <div className="ll-sheet">
      <div ref={root} data-testid="body" {...pointer}>
        <span>{paused ? 'pausa' : `${secondsLeft}s`}</span>
        <button type="button">Cerrar</button>
      </div>
    </div>
  );
}

describe('Cuenta atrás de los avisos en táctil', () => {
  it('un toque fuera de los botones pausa y otro reanuda', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<Harness onDone={done} />);
    const body = screen.getByTestId('body');
    fireEvent.pointerUp(body, { pointerType: 'touch' });
    expect(screen.getByText('pausa')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(done).not.toHaveBeenCalled();
    fireEvent.pointerUp(body, { pointerType: 'touch' });
    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('tocar un botón no pausa y el ratón se rige por el cursor', async () => {
    vi.useFakeTimers();
    render(<Harness onDone={() => undefined} />);
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Cerrar' }), { pointerType: 'touch' });
    expect(screen.queryByText('pausa')).toBeNull();
    fireEvent.pointerUp(screen.getByTestId('body'), { pointerType: 'mouse' });
    expect(screen.queryByText('pausa')).toBeNull();
  });
});
