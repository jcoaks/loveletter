import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  /** Nombre accesible de la ventana. */
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  /** Sin `onClose` no hay botón de cerrar, ni Escape, ni clic fuera. */
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  tone?: 'default' | 'hit' | 'warn';
  role?: 'dialog' | 'alertdialog';
}

// Pila de ventanas abiertas: solo la de arriba reacciona a Escape.
const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = '';

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana modal accesible: foco atrapado, Escape y clic fuera para cerrar, retorno de foco al
 * abridor, fondo `inert` y sin scroll. Se monta al abrir (renderizado condicional del dueño).
 */
export function Sheet({
  label,
  title,
  sub,
  onClose,
  children,
  footer,
  wide,
  tone = 'default',
  role = 'dialog',
}: SheetProps) {
  const veilRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const veil = veilRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const me = Symbol('sheet');
    stack.push(me);

    // Fondo inerte (todo lo que no sea esta ventana).
    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === veil || el.tagName === 'SCRIPT' || el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      inerted.push(el);
    }
    if (scrollLocks++ === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    sheetRef.current?.focus();

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === me && closeRef.current) {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      for (const el of inerted) el.removeAttribute('inert');
      if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const trapTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      e.preventDefault();
      sheetRef.current.focus();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheetRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const cls = ['ll-sheet', wide && 'wide', tone === 'hit' && 'hit', tone === 'warn' && 'warn']
    .filter(Boolean)
    .join(' ');

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: el velo solo cierra con el puntero; el teclado usa Escape y el botón
    <div
      ref={veilRef}
      className="ll-veil"
      onKeyDown={trapTab}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal es válido en dialog y alertdialog (role variable) */}
      <div
        ref={sheetRef}
        className={cls}
        role={role}
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="ll-sh-hd">
          <div>
            <h3>{title}</h3>
            {sub && <span className="ll-lbl">{sub}</span>}
          </div>
          {onClose && (
            <button type="button" className="ll-x" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          )}
        </div>
        {children}
        {footer && <div className="ll-row2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Variante con control de apertura: no monta nada mientras `open` es falso. */
export function Modal({ open, ...props }: SheetProps & { open: boolean }) {
  return open ? <Sheet {...props} /> : null;
}
