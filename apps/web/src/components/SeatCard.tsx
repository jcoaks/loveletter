import type { ReactNode } from 'react';
import { type SeatData, seatChips, seatLabel } from '../lib/seat';
import { CardBack, CardFan } from './Card';
import { Tokens } from './Token';

export type SeatMark = 'hit' | 'miss' | 'picked';

/** Asiento de un rival: nombre, estados, reverso de su mano, descartes y fichas. */
export function SeatCard({
  seat,
  toWin,
  position = '',
  mark,
  onOpen,
  speech,
}: {
  seat: SeatData;
  toWin: number;
  /** Frase de un bot en este momento (burbuja junto al asiento). */
  speech?: string;
  /** Clase de posición en la mesa: `left`, `right` o vacío (fila superior). */
  position?: 'left' | 'right' | '';
  mark?: SeatMark;
  /** Abre el detalle de descartes. Sin esto, el asiento no es interactivo. */
  onOpen?: () => void;
}) {
  const cls = ['ll-seat', position, seat.eliminated && 'out', seat.isTurn && 'turnof', mark]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      {speech && (
        <span className="ll-bubble" role="status" aria-live="polite">
          <span className="sr-only-ll">{seat.name} dice: </span>
          {speech}
        </span>
      )}
      <span className="ll-hd">
        <b>{seat.name}</b>
        {seatChips(seat).map((c) => (
          <i key={c.label} className={`ll-chip${c.on ? ' on' : ''}`}>
            {c.label}
          </i>
        ))}
      </span>
      <span className="ll-seat-row">
        <span className="ll-backs">
          {!seat.eliminated &&
            Array.from({ length: seat.handCount }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: reversos idénticos
              <CardBack key={i} />
            ))}
        </span>
        <CardFan cards={seat.discards} />
      </span>
      <span className="ll-seat-foot">
        <Tokens count={seat.tokens} total={toWin} />
        <span className="ll-lbl">Descartes{onOpen ? ' · ver' : ''}</span>
      </span>
    </>
  );
  if (!onOpen) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario
      <div className={cls} role="group" aria-label={seatLabel(seat, toWin, false)}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={cls} onClick={onOpen} aria-label={seatLabel(seat, toWin)}>
      {body}
    </button>
  );
}

/** Franja con los descartes y fichas propios, debajo de la mano. */
export function MineBar({
  seat,
  toWin,
  onOpen,
  children,
}: {
  seat: SeatData;
  toWin: number;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const cls = `ll-mine${seat.eliminated ? ' out' : ''}`;
  const label = `Tus descartes: ${seat.discards.length ? seat.discards.length : 'ninguno'}. ${seat.tokens} de ${toWin} fichas.${onOpen ? ' Ver descartes' : ''}`;
  const body = (
    <>
      <span className="ll-lbl">Tus descartes{onOpen ? ' · ver detalle' : ''}</span>
      <CardFan cards={seat.discards} />
      <Tokens count={seat.tokens} total={toWin} />
      {seatChips(seat)
        .filter((c) => !c.on)
        .map((c) => (
          <i key={c.label} className="ll-chip">
            {c.label}
          </i>
        ))}
      {children}
    </>
  );
  return onOpen ? (
    <button type="button" className={cls} onClick={onOpen} aria-label={label}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
