import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

/** Confirmación de una acción irreversible (p. ej. jugar la Princesa). */
export function ConfirmDialog({
  label,
  title,
  sub = 'Esta acción no se puede deshacer.',
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: {
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      label={label}
      title={title}
      sub={sub}
      tone="warn"
      role="alertdialog"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="ll-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="ll-play" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {children && <p className="ll-rtxt">{children}</p>}
    </Sheet>
  );
}
