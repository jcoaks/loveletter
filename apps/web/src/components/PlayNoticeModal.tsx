import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useCountdown } from '../hooks/useCountdown';
import { type CardValue, cardName, withArticle } from '../lib/cards';
import type { ResultFace, TableResult } from '../lib/results';
import { Card } from './Card';
import { CardFlyer } from './CardFlyer';
import type { Rect } from './DrawLayer';
import { Sheet } from './Sheet';

/**
 * Lo que enseña el aviso de una jugada: la carta ya en la mesa y, según avanza, el objetivo y el
 * resultado. `result` es null mientras el jugador aún elige (la ventana se queda esperando y se
 * completa en el mismo sitio cuando llega el resultado).
 */
export interface NoticeView {
  /** Estable de principio a fin de la jugada: la ventana no se cierra ni se reabre al completarse. */
  key: string;
  actorId: string;
  card: CardValue;
  targetId: string | null;
  result: TableResult | null;
  /** La carta vuela desde la mano o el asiento hasta el aviso al abrirse. */
  fly: boolean;
  /** Sin jugada declarada previa (bots, cartas sin objetivo): el aviso va revelando carta, objetivo y resultado. */
  staged: boolean;
}

/** Texto mientras el jugador todavía decide. */
export function waitingText(card: CardValue, actor: string, target: string | null): string {
  switch (card) {
    case 1:
      return target
        ? `${actor} acusa a ${target} y elige la carta que cree que tiene…`
        : `${actor} elige a quién acusar…`;
    case 2:
      return `${actor} elige de quién mirar la mano…`;
    case 3:
      return `${actor} elige con quién comparar manos…`;
    case 5:
      return `${actor} elige quién descarta su mano y roba…`;
    case 6:
      return `${actor} roba, elige una carta y deja el resto al fondo del mazo…`;
    case 7:
      return `${actor} elige con quién intercambiar manos…`;
    default:
      return `${actor} está jugando…`;
  }
}

const rectOf = (el: Element | null | undefined): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/** De dónde sale la carta de un rival: su última carta de espaldas, o su asiento. */
export function seatOrigin(playerId: string): Rect | null {
  const seat = document.querySelector(`[data-seat-id="${playerId.replace(/"/g, '\\"')}"]`);
  const backs = seat?.querySelectorAll('.ll-backs .ll-back');
  return rectOf(backs?.[backs.length - 1]) ?? rectOf(seat);
}

/** Pausas del aviso por pasos (carta → objetivo → resultado). */
const RESULT_BEAT_MS = 1000;

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
 * Aviso de una jugada, el mismo para quien la hace y para quien la ve: la carta sale de la mano o
 * del asiento y aterriza aquí; después aparece el objetivo y por último el resultado. Si el
 * jugador aún elige (`view.result` nulo) espera sin botón; con resultado se cierra solo, con cuenta
 * visible que se pausa al pasar el cursor o enfocar.
 */
export function PlayNoticeModal({
  view,
  actorName,
  targetName,
  mine,
  origin,
  autoCloseMs,
  onContinue,
}: {
  view: NoticeView;
  actorName: string;
  targetName: string | null;
  /** Quien juega eres tú. */
  mine: boolean;
  /** Dónde estaba tu carta al jugarla (solo si `mine`). */
  origin?: Rect | null;
  /** Milisegundos hasta cerrarse solo cuando ya hay resultado (con cursor o foco encima se detiene). */
  autoCloseMs: number;
  onContinue: () => void;
}) {
  const { result, card } = view;
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion());
  const [landed, setLanded] = useState(!view.fly || reduced.current);
  const [flight, setFlight] = useState<{ from: Rect; to: Rect } | null>(null);
  // Solo hay pasos que revelar si la carta de verdad voló (sin diseño, todo aparece de golpe).
  const flew = useRef(false);
  // 0: solo la carta · 1: también el objetivo · 2: todo.
  const [level, setLevel] = useState<0 | 1 | 2>(view.staged && !reduced.current ? 0 : 2);

  // Sin diseño (pantalla tapada, pruebas) no hay a dónde volar: todo aparece sin pasos ni vuelo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al abrirse la ventana
  useLayoutEffect(() => {
    if (landed || rectOf(slotRef.current?.firstElementChild)) return;
    setLanded(true);
    setLevel(2);
  }, []);

  // Tras abrirse la hoja (en móvil sube) se mide el hueco de la carta y se lanza el vuelo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al abrirse la ventana
  useEffect(() => {
    if (landed) return;
    const timer = window.setTimeout(() => {
      const from = mine ? (origin ?? null) : seatOrigin(view.actorId);
      const to = rectOf(slotRef.current?.firstElementChild);
      if (from && to) {
        flew.current = true;
        setFlight({ from, to });
      } else {
        setLanded(true);
        setLevel(2);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, []);

  // Con pasos propios: una pausa con la carta sola, otra con el objetivo, y luego el resultado.
  const hasTarget = view.targetId !== null || Boolean(result?.other?.targetId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: avanza solo cuando aterriza la carta
  useEffect(() => {
    if (!view.staged || !landed || !flew.current || reduced.current) return;
    if (!hasTarget) return setLevel(2);
    setLevel(1);
    const timer = window.setTimeout(() => setLevel(2), RESULT_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [landed]);

  const done = Boolean(result) && level === 2;
  const { elapsed, secondsLeft, paused, pointer } = useCountdown({
    ms: done ? autoCloseMs : Number.POSITIVE_INFINITY,
    resetKey: `${view.key}:${done}`,
    onDone: onContinue,
    root: rootRef,
  });

  const showTarget = targetName !== null && (view.staged ? level >= 1 : true);
  const who = mine ? 'Tú' : actorName;
  const label = mine ? `Tu jugada: ${cardName(card)}` : `Jugada de ${actorName}: ${cardName(card)}`;
  const title = `${who} ${mine ? 'jugaste' : 'jugó'} ${withArticle(card)}`;
  const sheetFor = result && done;
  const other = result?.other;
  return (
    <>
      <Sheet
        label={result?.label ?? label}
        title={result?.title ?? title}
        sub={
          <>
            <i className="ll-chip">
              {result?.visibility === 'private' ? 'Solo tú lo ves' : 'Público'}
            </i>{' '}
            {(other?.affectsMe ?? (!mine && targetName === 'Ti')) ? 'Te afecta' : 'Jugada'}
          </>
        }
        tone={result?.hit && level === 2 ? 'hit' : 'default'}
        onClose={sheetFor ? onContinue : undefined}
      >
        <div className="grid gap-4" ref={rootRef} {...pointer}>
          <div className="ll-notice-row">
            <div ref={slotRef} className={landed ? undefined : 'll-pending'}>
              <Card value={card} ariaLabel={`Carta jugada: ${cardName(card)}`} />
            </div>
            <div className="ll-notice-txt grid">
              <p className="m-0">
                <span className="ll-lbl">Jugó</span>
                <br />
                <b className="font-display text-lg tracking-wider">{actorName}</b>
              </p>
              {showTarget && (
                <p className="m-0">
                  <span className="ll-lbl">Contra</span>
                  <br />
                  <b className="font-display text-lg tracking-wider">{targetName}</b>
                </p>
              )}
              <p className="ll-rtxt" style={{ textAlign: 'left' }} role="status">
                {result && level === 2
                  ? result.body
                  : waitingText(card, actorName, showTarget ? targetName : null)}
              </p>
              {result?.effect && level === 2 && (
                <p className="ll-fxline">
                  <span className="ll-lbl">Qué hace</span> {result.effect}
                </p>
              )}
            </div>
          </div>
          {level === 2 && result && result.faces.length > 0 && <FaceRow faces={result.faces} />}
          {level === 2 && result?.secretFaces && result.secretFaces.length > 0 && (
            <section aria-label="Solo tú lo ves" className="grid justify-items-center gap-2">
              <i className="ll-chip">Solo tú lo ves</i>
              <FaceRow faces={result.secretFaces} />
            </section>
          )}
          {sheetFor && (
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
          )}
        </div>
      </Sheet>
      {flight && !landed && (
        <CardFlyer
          card={card}
          from={flight.from}
          to={flight.to}
          fromBack={!mine}
          onLand={() => setLanded(true)}
        />
      )}
    </>
  );
}
