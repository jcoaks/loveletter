import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && (
        <Sheet
          label="Prueba"
          title="Título"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          footer={<button type="button">Aceptar</button>}
        >
          <button type="button">Dentro</button>
        </Sheet>
      )}
    </>
  );
}

describe('Sheet', () => {
  it('enfoca la ventana, traba el scroll y deja el fondo inerte', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Prueba' });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('atrapa el foco con Tab y Mayús+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const accept = screen.getByRole('button', { name: 'Aceptar' });
    close.focus();
    await user.tab({ shift: true });
    expect(accept).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });

  it('cierra con Escape y devuelve el foco y el fondo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('el botón de cerrar existe solo con onClose', () => {
    render(<Sheet label="Fija" title="Fija" />);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });
});
