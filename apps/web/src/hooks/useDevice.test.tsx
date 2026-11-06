import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTurnVibration, useWakeLock } from './useDevice';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'vibrate');
  Reflect.deleteProperty(navigator, 'wakeLock');
});

function Vibrates({ turn, on }: { turn: boolean; on: boolean }) {
  useTurnVibration(turn, on);
  return null;
}
function Awake({ on }: { on: boolean }) {
  useWakeLock(on);
  return null;
}

describe('Vibración en tu turno', () => {
  it('vibra al empezar tu turno solo si está activada', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { rerender } = render(<Vibrates turn={false} on />);
    expect(vibrate).not.toHaveBeenCalled();
    rerender(<Vibrates turn on />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    rerender(<Vibrates turn on={false} />);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('sin soporte no hace nada ni falla', () => {
    expect(() => render(<Vibrates turn on />)).not.toThrow();
  });
});

describe('Pantalla encendida', () => {
  it('pide el bloqueo y lo suelta al salir', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() =>
      Promise.resolve({ release, released: false, addEventListener: vi.fn() }),
    );
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = render(<Awake on />);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    unmount();
    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('si el navegador lo rechaza, la partida sigue', async () => {
    const request = vi.fn(() => Promise.reject(new Error('denegado')));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    expect(() => render(<Awake on />)).not.toThrow();
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
  });

  it('apagado no pide nada', () => {
    const request = vi.fn();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(<Awake on={false} />);
    expect(request).not.toHaveBeenCalled();
  });
});
