import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameMenu } from './GameMenu';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'vibrate');
  Reflect.deleteProperty(navigator, 'wakeLock');
});

function setup(over: Partial<Parameters<typeof GameMenu>[0]> = {}) {
  const props = {
    noticeMode: 'full' as const,
    onNoticeMode: vi.fn(),
    haptics: false,
    onHaptics: vi.fn(),
    wake: true,
    onWake: vi.fn(),
    onGuide: vi.fn(),
    onLeave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<GameMenu {...props} />);
  return { props, user: userEvent.setup() };
}

describe('Menú "Más" del móvil', () => {
  it('es una ventana con la guía, los avisos y salir', async () => {
    const { props, user } = setup();
    expect(screen.getByRole('dialog', { name: 'Más opciones' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Carta guía/ }));
    expect(props.onGuide).toHaveBeenCalled();
    await user.click(screen.getByRole('switch', { name: /Avisos de jugadas completos/ }));
    expect(props.onNoticeMode).toHaveBeenCalledWith('brief');
    await user.click(screen.getByRole('button', { name: /Salir de la partida/ }));
    expect(props.onLeave).toHaveBeenCalled();
  });

  it('la vibración y la pantalla encendida solo aparecen si el navegador las admite', async () => {
    setup();
    expect(screen.queryByRole('switch', { name: /Vibrar/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /pantalla encendida/ })).toBeNull();
    cleanup();
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
    Object.defineProperty(navigator, 'wakeLock', { value: {}, configurable: true });
    const { props, user } = setup();
    const vib = screen.getByRole('switch', { name: /Vibrar en tu turno/ });
    expect(vib).toHaveAttribute('aria-checked', 'false');
    await user.click(vib);
    expect(props.onHaptics).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: /pantalla encendida/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
