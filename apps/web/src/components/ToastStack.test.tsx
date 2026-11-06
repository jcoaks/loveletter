import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ToastItem, ToastStack } from './ToastStack';

afterEach(() => vi.useRealTimers());

function Harness({ initial }: { initial: ToastItem[] }) {
  const [items, setItems] = useState(initial);
  return (
    <ToastStack items={items} onDismiss={(k) => setItems((l) => l.filter((i) => i.key !== k))} />
  );
}

const many = (n: number): ToastItem[] =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, body: `Aviso ${i + 1}` }));

describe('ToastStack', () => {
  it('muestra hasta 3 apilados y el resto espera su turno', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness initial={many(4)} />);
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.queryByText('Aviso 4')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(4700));
    // Los tres primeros expiraron a la vez; entra el cuarto y arranca su propia cuenta.
    expect(screen.getByText('Aviso 4')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(4700));
    expect(screen.queryByText('Aviso 4')).toBeNull();
  });

  it('sin botón Continuar; × de 44 px cierra antes', async () => {
    render(<Harness initial={many(1)} />);
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Aviso 1')).toBeNull();
  });

  it('los errores usan role=alert y duran más', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness initial={[{ key: 'e', body: 'Sin conexión', tone: 'alert' }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.queryByText('Sin conexión')).toBeNull();
  });

  it('con el foco dentro la cuenta se detiene', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Harness initial={many(1)} />);
    act(() => screen.getByRole('button', { name: 'Cerrar aviso' }).focus());
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByText('Aviso 1')).toBeInTheDocument();
  });
});
