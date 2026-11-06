import type { ReactNode } from 'react';
import type { CardValue } from '../lib/cards';
import type { SeatData } from '../lib/seat';
import { CardBack, CardFan } from './Card';
import { GuidePanel } from './GuidePanel';
import { LogPanel } from './LogPanel';
import { SeatCard, type SeatMark } from './SeatCard';

function DeckStack({ count }: { count: number }) {
  return (
    <div className="ll-stack" role="img" aria-label={`Mazo: ${count} cartas`}>
      <CardBack />
      <CardBack />
      <CardBack />
      <em aria-hidden="true">{count}</em>
    </div>
  );
}

/**
 * Mesa: laterales + fila superior + centro (mazo / turno / apartada) + mano propia, con la
 * carta guía a la derecha desde 1200 px. Reparte de 0 a 5 rivales: 1 arriba; 2 a los lados;
 * 3 o más, primero a la izquierda, último a la derecha y el resto arriba.
 */
export function TableLayout({
  rivals,
  toWin,
  deckCount,
  setAside,
  turn,
  mine,
  log,
  marks,
  onOpenSeat,
  onOpenGuide,
  speech,
  children,
}: {
  rivals: readonly SeatData[];
  toWin: number;
  deckCount: number;
  /** Cartas apartadas: `hidden` boca abajo y `faceUp` visibles (partidas de 2). */
  setAside: { hidden: number; faceUp: readonly CardValue[] };
  /** Bloque central de turno (normalmente un `TurnBanner`). */
  turn: ReactNode;
  /** Mano propia, acciones y franja de descartes. */
  mine: ReactNode;
  log: readonly string[];
  marks?: Record<string, SeatMark>;
  onOpenSeat?: (id: string) => void;
  onOpenGuide?: () => void;
  /** Frases de bots en pantalla, por id de jugador. */
  speech?: Record<string, string>;
  /** Overlays (avisos, etc.). Las ventanas modales van en su propio portal. */
  children?: ReactNode;
}) {
  const few = rivals.length <= 1;
  const sides = few ? [] : [rivals[0], rivals[rivals.length - 1]];
  const top = few ? rivals : rivals.slice(1, -1);
  const [left, right] = sides;
  const seat = (s: SeatData, position: 'left' | 'right' | '') => (
    <SeatCard
      key={s.id}
      seat={s}
      toWin={toWin}
      position={position}
      mark={marks?.[s.id]}
      speech={speech?.[s.id]}
      onOpen={onOpenSeat ? () => onOpenSeat(s.id) : undefined}
    />
  );
  const aside = setAside.hidden + setAside.faceUp.length;

  return (
    <section className="ll-board" aria-label="Mesa de juego">
      <div className="ll-main">
        <div className={`ll-table${few ? ' few' : ''}${rivals.length === 2 ? ' notop' : ''}`}>
          {top.length > 0 && <div className="ll-toprow">{top.map((s) => seat(s, ''))}</div>}
          {left && seat(left, 'left')}
          {right && seat(right, 'right')}
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
        <LogPanel entries={log} />
      </div>
      {onOpenGuide && <GuidePanel onOpen={onOpenGuide} />}
      {children}
    </section>
  );
}
