import type { ReactNode } from 'react';
import type { CardValue } from '../lib/cards';
import type { CardCounts } from '../lib/counts';
import type { SeatData } from '../lib/seat';
import { CardBack, CardFan } from './Card';
import { GuidePanel } from './GuidePanel';
import { LogPanel } from './LogPanel';
import { SeatCard, type SeatMark } from './SeatCard';

/** Mazo: tantas cartas apiladas como queden (hasta 3); vacío, un hueco con el 0. Caja de tamaño fijo. */
export function DeckStack({ count }: { count: number }) {
  const layers = Math.min(3, Math.max(0, count));
  return (
    <div
      className={`ll-stack${layers === 0 ? ' empty' : ''}`}
      role="img"
      aria-label={`Mazo: ${count} ${count === 1 ? 'carta' : 'cartas'}`}
    >
      {Array.from({ length: layers }, (_, k) => {
        // La carta de arriba siempre en la misma posición, donde va el contador.
        const slot = k + (3 - layers);
        return (
          <CardBack
            // biome-ignore lint/suspicious/noArrayIndexKey: reversos idénticos
            key={k}
            style={{ left: slot * 3, top: (2 - slot) * 3 }}
          />
        );
      })}
      <em aria-hidden="true">{count}</em>
    </div>
  );
}

/**
 * Mesa compacta: rivales en una fila, centro (mazo / turno / apartada), tu mano con tus descartes
 * al lado y, debajo, la barra de acciones. En escritorio todo cabe en `100dvh`; la carta guía
 * va a la derecha desde 1200 px.
 */
export function TableLayout({
  rivals,
  toWin,
  deckCount,
  setAside,
  turn,
  mine,
  actions,
  log,
  marks,
  onOpenSeat,
  onOpenGuide,
  speech,
  guideCounts,
  children,
}: {
  rivals: readonly SeatData[];
  toWin: number;
  deckCount: number;
  /** Cartas apartadas: `hidden` boca abajo y `faceUp` visibles (partidas de 2). */
  setAside: { hidden: number; faceUp: readonly CardValue[] };
  /** Bloque central de turno (normalmente un `TurnBanner`). */
  turn: ReactNode;
  /** Tu mano y tus descartes. */
  mine: ReactNode;
  /** Barra de acciones (siempre visible bajo la mesa). */
  actions?: ReactNode;
  /** Registro en línea (opcional: en la partida va en un panel aparte). */
  log?: readonly string[];
  marks?: Record<string, SeatMark>;
  onOpenSeat?: (id: string) => void;
  onOpenGuide?: () => void;
  /** Frases de bots en pantalla, por id de jugador. */
  speech?: Record<string, string>;
  /** Copias por aparecer de cada carta, para la carta guía. */
  guideCounts?: CardCounts;
  children?: ReactNode;
}) {
  const aside = setAside.hidden + setAside.faceUp.length;
  return (
    <section className="ll-board" aria-label="Mesa de juego">
      <div className="ll-main">
        <div className="ll-table">
          <div className="ll-rivals" data-count={rivals.length}>
            {rivals.map((s) => (
              <SeatCard
                key={s.id}
                seat={s}
                toWin={toWin}
                mark={marks?.[s.id]}
                speech={speech?.[s.id]}
                onOpen={onOpenSeat ? () => onOpenSeat(s.id) : undefined}
              />
            ))}
          </div>
          <div className="ll-center">
            <div className="ll-pile">
              <div className="ll-slot">
                <DeckStack count={deckCount} />
              </div>
              <span className="ll-lbl">Mazo</span>
            </div>
            {turn}
            <div className="ll-pile">
              <div className="ll-slot">
                <span
                  className="ll-fan"
                  style={{ minHeight: 0, paddingLeft: 0 }}
                  role="img"
                  aria-label={`${aside === 1 ? 'Carta apartada' : 'Cartas apartadas'}: ${setAside.hidden} boca abajo${setAside.faceUp.length ? ` y ${setAside.faceUp.length} boca arriba` : ''}`}
                >
                  {Array.from({ length: setAside.hidden }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: reversos idénticos
                    <CardBack key={i} />
                  ))}
                  <CardFan cards={setAside.faceUp} />
                </span>
              </div>
              <span className="ll-lbl">{aside > 1 ? 'Apartadas' : 'Apartada'}</span>
            </div>
          </div>
          <div className="ll-me">{mine}</div>
        </div>
        {actions && <div className="ll-actbar">{actions}</div>}
        {log && <LogPanel entries={log} />}
      </div>
      {onOpenGuide && <GuidePanel onOpen={onOpenGuide} counts={guideCounts} />}
      {children}
    </section>
  );
}
