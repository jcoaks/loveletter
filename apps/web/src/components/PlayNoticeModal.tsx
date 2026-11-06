import { useRef } from 'react';
import { prefersReducedMotion, useCountdown } from '../hooks/useCountdown';
import { cardName } from '../lib/cards';
import type { ResultFace, TableResult } from '../lib/results';
import { Card } from './Card';
import { Sheet } from './Sheet';

function FaceRow({ faces }: { faces: readonly ResultFace[] }) {
  return (
    <div className="ll-faces big compact" data-n={faces.length}>
      {faces.map((f) => (
        <div key={`${f.caption}-${f.value}`} className="ll-dwrap">
          <Card value={f.value} ariaLabel={`${f.caption}: ${cardName(f.value)}`} />
          <span className="ll-lbl">{f.caption}</span>
        </div>
      ))}
    </div>
  );
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
  /** Milisegundos hasta cerrarse solo (siempre se cierra; con cursor o foco encima se detiene). */
  autoCloseMs: number;
  onContinue: () => void;
}) {
  const other = notice.other;
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion());
  const { elapsed, secondsLeft, paused, pointer } = useCountdown({
    ms: autoCloseMs,
    resetKey: notice.key,
    onDone: onContinue,
    root: rootRef,
  });

  if (!other) return null;
  return (
    <Sheet
      label={notice.label}
      title={notice.title}
      sub={
        <>
          <i className="ll-chip">
            {notice.visibility === 'private' ? 'Solo tú lo ves' : 'Público'}
          </i>{' '}
          {other.affectsMe ? 'Te afecta' : 'Jugada'}
        </>
      }
      tone={notice.hit ? 'hit' : 'default'}
      onClose={onContinue}
    >
      <div className="grid gap-4" ref={rootRef} {...pointer}>
        <div className="ll-notice-row">
          <Card value={other.card} ariaLabel={`Carta jugada: ${notice.label}`} />
          <div className="ll-notice-txt grid">
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
            {notice.effect && (
              <p className="ll-fxline">
                <span className="ll-lbl">Qué hace</span> {notice.effect}
              </p>
            )}
          </div>
        </div>
        {notice.faces.length > 0 && <FaceRow faces={notice.faces} />}
        {notice.secretFaces && notice.secretFaces.length > 0 && (
          <section aria-label="Solo tú lo ves" className="grid justify-items-center gap-2">
            <i className="ll-chip">Solo tú lo ves</i>
            <FaceRow faces={notice.secretFaces} />
          </section>
        )}
        <div className="ll-row2">
          <div className="grid min-w-[160px] flex-1 items-center gap-1">
            {!reduced.current && (
              <div
                role="progressbar"
                aria-label="Tiempo hasta cerrarse"
                aria-valuemin={0}
                aria-valuemax={Math.round(autoCloseMs / 1000)}
                aria-valuenow={secondsLeft}
                className="h-1.5 overflow-hidden rounded-full bg-black/40"
              >
                <div
                  className="h-full bg-gold"
                  style={{ width: `${Math.min(100, (elapsed / autoCloseMs) * 100)}%` }}
                />
              </div>
            )}
            <span className="ll-lbl" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {paused
                ? 'En pausa · toca para seguir'
                : `Se cierra en ${secondsLeft} s · toca para pausar`}
            </span>
          </div>
          <button type="button" className="ll-play" onClick={onContinue}>
            Entendido
          </button>
        </div>
      </div>
    </Sheet>
  );
}
