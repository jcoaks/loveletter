import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChancellorModal } from './ChancellorModal';

describe('ChancellorModal', () => {
  it('conserva una carta y permite reordenar el fondo', async () => {
    const onConfirm = vi.fn();
    render(
      <ChancellorModal options={[3, 9, 6]} onConfirm={onConfirm} onCancel={() => undefined} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Conservar Barón' }));

    const list = screen.getByRole('list', { name: /Orden al fondo/ });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Primera al fondo');
    expect(screen.getByRole('button', { name: 'Subir Princesa' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Princesa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar orden' }));
    expect(onConfirm).toHaveBeenCalledWith({ keep: 3, bottom: [6, 9] });
  });

  it('Cambiar carta vuelve a la elección', async () => {
    render(
      <ChancellorModal
        options={[3, 9, 6]}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Conservar Barón' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar carta' }));
    expect(screen.getByRole('button', { name: 'Conservar Princesa' })).toBeInTheDocument();
  });

  it('con una sola carta para el fondo confirma sin ordenar', async () => {
    const onConfirm = vi.fn();
    render(<ChancellorModal options={[3, 9]} onConfirm={onConfirm} onCancel={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Conservar Princesa' }));
    expect(onConfirm).toHaveBeenCalledWith({ keep: 9, bottom: [3] });
  });
});
