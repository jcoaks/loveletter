import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuardModal } from './GuessPicker';
import { type PickerPlayer, PlayerPickerModal } from './PlayerPickerModal';

const players: PickerPlayer[] = [
  { id: 'me', name: 'Tú', isMe: true, eligible: true, discards: [], tokens: 0 },
  { id: 'a', name: 'Marta', gender: 'f', eligible: false, discards: [4], tokens: 1 },
  { id: 'b', name: 'Diego', eligible: false, eliminated: true, discards: [2], tokens: 0 },
  { id: 'c', name: 'Lucía', gender: 'f', eligible: true, discards: [], tokens: 1 },
];

describe('PlayerPickerModal', () => {
  it('con el Barón tu cuadro va al final, deshabilitado, y se deshabilitan los no elegibles', async () => {
    const onPick = vi.fn();
    render(
      <PlayerPickerModal
        card={3}
        players={players}
        toWin={4}
        onPick={onPick}
        onCancel={() => undefined}
      />,
    );
    // Tu propio cuadro: al final, atenuado, con su estado y sin poder elegirse.
    const tiles = screen.getAllByRole('button').filter((b) => b.classList.contains('ll-ptile'));
    expect(tiles.map((t) => t.textContent?.split('No')[0])).toHaveLength(4);
    const me = tiles[tiles.length - 1] as HTMLElement;
    expect(me).toHaveTextContent('Tú (tú)');
    expect(me).toHaveTextContent('No puedes elegirte');
    expect(me).toHaveTextContent('Sin descartes');
    expect(me).toHaveAttribute('aria-disabled', 'true');
    expect(me).toHaveClass('off');
    await userEvent.click(me);
    expect(onPick).not.toHaveBeenCalled();
    // Los rivales conservan su orden.
    expect(tiles.slice(0, 3).map((t) => t.querySelector('b')?.textContent)).toEqual([
      'Marta',
      'Diego',
      'Lucía',
    ]);
    const marta = screen.getByRole('button', { name: /Marta/ });
    expect(marta).toHaveAttribute('aria-disabled', 'true');
    expect(marta).toHaveTextContent('Protegida');
    expect(screen.getByRole('button', { name: /Diego/ })).toHaveTextContent('Eliminado');
    await userEvent.click(marta);
    expect(onPick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Lucía/ }));
    expect(onPick).toHaveBeenCalledWith('c');
  });

  it('con el Príncipe permite elegirse y explica el descarte', async () => {
    const onPick = vi.fn();
    render(
      <PlayerPickerModal
        card={5}
        players={players}
        toWin={4}
        restCard={8}
        onPick={onPick}
        onCancel={() => undefined}
      />,
    );
    const me = screen.getByRole('button', { name: /Tú \(tú\)/ });
    expect(me).toHaveTextContent('Descartas Condesa y robas');
    await userEvent.click(me);
    expect(onPick).toHaveBeenCalledWith('me');
  });

  it('Guardia: acusar exige jugador y carta', async () => {
    const onAccuse = vi.fn();
    const { rerender } = render(
      <GuardModal
        players={players}
        toWin={4}
        targetId={null}
        guess={null}
        onTarget={() => undefined}
        onGuess={() => undefined}
        onAccuse={onAccuse}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Acusar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Barón/ })).toBeDisabled();
    rerender(
      <GuardModal
        players={players}
        toWin={4}
        targetId="c"
        guess={3}
        onTarget={() => undefined}
        onGuess={() => undefined}
        onAccuse={onAccuse}
        onCancel={() => undefined}
      />,
    );
    const go = screen.getByRole('button', { name: 'Acusar a Lucía: Barón' });
    await userEvent.click(go);
    expect(onAccuse).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /^1/ })).not.toBeInTheDocument();
  });
});
