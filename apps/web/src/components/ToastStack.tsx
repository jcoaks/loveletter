import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface ToastItem {
  key: string;
  body: ReactNode;
  /** `alert` para errores (se anuncian con prioridad y duran un poco más). */
  tone?: 'status' | 'alert';
  /** Milisegundos hasta cerrarse solo. */
  ms?: number;
}

export const TOAST_MS = 4500;
export const TOAST_ALERT_MS = 6000;
const TICK_MS = 100;
const MAX_VISIBLE = 3;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (key: string) => void }) {
  const alert = item.tone === 'alert';
  const ms = item.ms ?? (alert ? TOAST_ALERT_MS : TOAST_MS);
  const [elapsed, setElapsed] = useState(0);
  const paused = useRef(false);
  const done = useRef(false);
  const close = useRef(onDismiss);
  close.current = onDismiss;
  const reduced = useRef(reducedMotion());

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused.current) setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (elapsed >= ms && !done.current) {
      done.current = true;
      close.current(item.key);
    }
  }, [elapsed, ms, item.key]);

  const pause = (on: boolean) => () => {
    paused.current = on;
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: solo pausa la cuenta atrás con el puntero y el foco
    <div
      className={`ll-toast${alert ? ' alert' : ''}`}
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? 'assertive' : 'polite'}
      onMouseEnter={pause(true)}
      onMouseLeave={pause(false)}
      onPointerDown={(e) => e.pointerType !== 'mouse' && pause(true)()}
      onPointerUp={(e) => e.pointerType !== 'mouse' && pause(false)()}
      onPointerCancel={pause(false)}
      onFocus={pause(true)}
      onBlur={pause(false)}
    >
      <p>{item.body}</p>
      <button
        type="button"
        className="ll-toast-x"
        onClick={() => onDismiss(item.key)}
        aria-label="Cerrar aviso"
      >
        <span aria-hidden="true">×</span>
      </button>
      {!reduced.current && (
        <span
          className="ll-toast-bar"
          aria-hidden="true"
          style={{ width: `${Math.max(0, 100 - (elapsed / ms) * 100)}%` }}
        />
      )}
    </div>
  );
}

/**
 * Avisos informativos que no bloquean el juego: se apilan (hasta 3 a la vez, el resto espera),
 * se cierran solos con una barra discreta, se pausan con el cursor o el foco y no llevan botón de
 * continuar, solo una × para cerrarlos antes. Van arriba para no tapar la barra de acciones.
 */
export function ToastStack({
  items,
  onDismiss,
  anchored = false,
}: {
  items: readonly ToastItem[];
  onDismiss: (key: string) => void;
  /** Colgado justo bajo su contenedor posicionado (la barra de la partida) en vez de fijo arriba. */
  anchored?: boolean;
}) {
  return (
    <div className={`ll-toasts${anchored ? ' anchored' : ''}`}>
      {items.slice(0, MAX_VISIBLE).map((item) => (
        <ToastView key={item.key} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
