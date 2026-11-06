import { type ReactNode, useRef } from 'react';
import { prefersReducedMotion, useCountdown } from '../hooks/useCountdown';
import { type CardValue, cardName } from '../lib/cards';
import { Card } from './Card';
import { Sheet } from './Sheet';

export interface ResultFace {
  caption: string;
  value: CardValue;
}

/** Resultado de una jugada, con etiqueta Privado / Público. */
export function ResultModal({
  label,
  title,
  body,
  faces = [],
  visibility,
  hit = false,
  onContinue,
  autoCloseMs,
  resetKey = '',
}: {
  label: string;
  title: ReactNode;
  body: ReactNode;
  faces?: readonly ResultFace[];
  visibility: 'private' | 'public';
  /** Alguien quedó fuera: borde de alerta. */
  hit?: boolean;
  onContinue: () => void;
  /** Si se da, se cierra solo (con cursor o foco encima se detiene) y el botón es "Entendido". */
  autoCloseMs?: number;
  resetKey?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion());
  const auto = autoCloseMs !== undefined;
  const { elapsed, secondsLeft, pointer } = useCountdown({
    ms: autoCloseMs ?? Number.POSITIVE_INFINITY,
    resetKey,
    onDone: onContinue,
    root: rootRef,
  });
  return (
    <Sheet
      label={label}
      title={title}
      sub={
        <i className="ll-chip">
          {visibility === 'private' ? 'Privado · solo tú lo ves' : 'Público · todos lo ven'}
        </i>
      }
      tone={hit ? 'hit' : 'default'}
      onClose={auto ? onContinue : undefined}
      footer={
        <button type="button" className="ll-play" onClick={onContinue}>
          {auto ? 'Entendido' : 'Continuar'}
        </button>
      }
    >
      <div className="grid gap-3" ref={rootRef} {...pointer}>
        <p className="ll-rtxt">{body}</p>
        {faces.length > 0 && (
          <div className="ll-faces big" data-n={faces.length}>
            {faces.map((f) => (
              <div key={`${f.caption}-${f.value}`} className="ll-dwrap">
                <Card value={f.value} ariaLabel={`${f.caption}: ${cardName(f.value)}`} />
                <span className="ll-lbl">{f.caption}</span>
              </div>
            ))}
          </div>
        )}
        {auto && (
          <div className="grid gap-1">
            {!reduced.current && (
              <div
                role="progressbar"
                aria-label="Tiempo hasta cerrarse"
                aria-valuemin={0}
                aria-valuemax={Math.round((autoCloseMs ?? 0) / 1000)}
                aria-valuenow={secondsLeft}
                className="h-1.5 overflow-hidden rounded-full bg-black/40"
              >
                <div
                  className="h-full bg-gold"
                  style={{ width: `${Math.min(100, (elapsed / (autoCloseMs ?? 1)) * 100)}%` }}
                />
              </div>
            )}
            <span className="ll-lbl">Se cierra en {secondsLeft} s</span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
