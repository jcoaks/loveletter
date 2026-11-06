import type { ReactNode } from 'react';

export interface ToastMessage {
  title: string;
  body?: ReactNode;
}

/**
 * Aviso para resultados triviales. La región `aria-live` existe siempre (vacía) para que los
 * lectores de pantalla anuncien el mensaje cuando aparece.
 */
export function Toast({
  message,
  onDismiss,
  actionLabel = 'Continuar',
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
  actionLabel?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div className="ll-toast">
          <p>
            <b>{message.title}</b> {message.body}
          </p>
          <button type="button" className="ll-ghost" onClick={onDismiss}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
