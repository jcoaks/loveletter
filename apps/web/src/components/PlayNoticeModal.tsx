import { useEffect, useRef, useState } from 'react';
import type { TableResult } from '../lib/results';
import { Card } from './Card';
import { Sheet } from './Sheet';

const TICK_MS = 100;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Aviso de la jugada de otro jugador: quién, qué carta (grande), contra quién y el resultado.
 * Si `autoCloseMs` está definido se cierra solo, con cuenta visible que se pausa al pasar el
 * cursor o enfocar; si no, espera a "Continuar".
 */
export function PlayNoticeModal({
  notice,
  actorName,
  targetName,
  autoCloseMs,
  onContinue,
}: {
  notice: TableResult;
  actorName: string;
  targetName: string | null;
  autoCloseMs: number | null;
  onContinue: () => void;
}) {
  const other = notice.other;
  const [elapsed, setElapsed] = useState(0);
  const paused = useRef(false);
  const done = useRef(false);
  const reduced = useRef(prefersReducedMotion());
  const close = useRef(onContinue);
  close.current = onContinue;

  // biome-ignore lint/correctness/useExhaustiveDependencies: un aviso nuevo reinicia la cuenta
  useEffect(() => {
    done.current = false;
    setElapsed(0);
    if (autoCloseMs === null) return;
    const timer = window.setInterval(() => {
      if (paused.current || done.current) return;
      setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [notice.key, autoCloseMs]);

  // Al llegar a cero se cierra una sola vez.
  useEffect(() => {
    if (autoCloseMs !== null && elapsed >= autoCloseMs && !done.current) {
      done.current = true;
      close.current();
    }
  }, [elapsed, autoCloseMs]);

  if (!other) return null;
  const left = autoCloseMs === null ? 0 : Math.max(0, Math.ceil((autoCloseMs - elapsed) / 1000));
  const pause = (on: boolean) => () => {
    paused.current = on;
  };

  return (
    <Sheet
      label={notice.label}
      title={notice.title}
      sub={
        <>
          <i className="ll-chip">
            {notice.visibility === 'private' ? 'Solo tú lo ves' : 'Público'}
          </i>{' '}
          {other.affectsMe ? 'Te afecta' : 'Jugada de otro jugador'}
        </>
      }
      tone={notice.hit ? 'hit' : 'default'}
      onClose={onContinue}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: solo pausa la cuenta atrás con el puntero y el foco */}
      <div
        className="grid gap-4"
        onMouseEnter={pause(true)}
        onMouseLeave={pause(false)}
        onFocus={pause(true)}
        onBlur={pause(false)}
      >
        <div className="flex flex-wrap items-center justify-center gap-5">
          <Card value={other.card} ariaLabel={`Carta jugada: ${notice.label}`} />
          <div className="grid min-w-[200px] flex-1 gap-2">
            <p className="m-0">
              <span className="ll-lbl">Jugó</span>
              <br />
              <b className="font-display text-lg tracking-wider">{actorName}</b>
            </p>
            {targetName && (
              <p className="m-0">
                <span className="ll-lbl">Contra</span>
                <br />
                <b className="font-display text-lg tracking-wider">{targetName}</b>
              </p>
            )}
            <p className="ll-rtxt" style={{ textAlign: 'left' }} role="status">
              {notice.body}
            </p>
          </div>
        </div>
        {notice.faces.length > 0 && (
          <div className="ll-faces">
            {notice.faces.map((f) => (
              <div key={`${f.caption}-${f.value}`} className="ll-dwrap">
                <Card value={f.value} size="sm" />
                <span className="ll-lbl">{f.caption}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ll-row2">
          {autoCloseMs !== null && (
            <div className="grid min-w-[160px] flex-1 items-center gap-1">
              {!reduced.current && (
                <div
                  role="progressbar"
                  aria-label="Tiempo hasta cerrarse"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(autoCloseMs / 1000)}
                  aria-valuenow={left}
                  className="h-1.5 overflow-hidden rounded-full bg-black/40"
                >
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${Math.min(100, (elapsed / autoCloseMs) * 100)}%` }}
                  />
                </div>
              )}
              <span className="ll-lbl">Se cierra en {left} s</span>
            </div>
          )}
          <button type="button" className="ll-play" onClick={onContinue}>
            Continuar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
