import type { CSSProperties } from 'react';
import { agree } from '../lib/gender';
import { type SeatData, seatLabel } from '../lib/seat';
import { CardBack, CardFan } from './Card';
import { Tokens } from './Token';

/**
 * Estados del asiento como iconos en una ranura de ancho fijo: aparecen y desaparecen sin
 * mover el nombre ni el resto del cuadro. El texto va en `aria-label` y `title`.
 */
export function StatusIcons({ seat }: { seat: SeatData }) {
  const items: { kind: 'out' | 'prot' | 'spy' | 'off'; label: string }[] = [];
  if (seat.eliminated) items.push({ kind: 'out', label: agree('Eliminado', seat.gender) });
  if (seat.protected && !seat.shield) {
    items.push({ kind: 'prot', label: agree('Protegido', seat.gender) });
  }
  if (seat.spyPlayed && !seat.eye) items.push({ kind: 'spy', label: 'Espía jugado' });
  if (seat.connected === false)
    items.push({ kind: 'off', label: agree('Desconectado', seat.gender) });
  return (
    <span className="ll-st">
      {items.map((i) => (
        <i
          key={i.kind}
          className={`ll-ico ${i.kind}`}
          role="img"
          aria-label={i.label}
          title={i.label}
        />
      ))}
    </span>
  );
}

export type SeatMark = 'hit' | 'miss' | 'picked';

/** Escudo que aparece sobre el cuadro al jugarse la Doncella y luego se recoge hacia el icono de estado. */
export function ShieldFx({ seat }: { seat: SeatData }) {
  if (seat.shield !== 'fx' && seat.eye !== 'fx') return null;
  return (
    <span className="ll-shield-fx" aria-hidden="true">
      <i className="ring" />
      {seat.shield === 'fx' && <i className="shield" />}
      {seat.eye === 'fx' && <i className="eye" />}
    </span>
  );
}

/** Asiento de un rival: nombre, estados, reverso de su mano, descartes y fichas. */
export function SeatCard({
  seat,
  toWin,
  position = '',
  mark,
  onOpen,
}: {
  seat: SeatData;
  toWin: number;
  /** Clase de posición en la mesa: `left`, `right` o vacío (fila superior). */
  position?: 'left' | 'right' | '';
  mark?: SeatMark;
  /** Abre el detalle de descartes. Sin esto, el asiento no es interactivo. */
  onOpen?: () => void;
}) {
  const cls = [
    'll-seat',
    position,
    seat.eliminated && 'out',
    seat.isTurn && 'turnof',
    (seat.shield === 'fx' || seat.eye === 'fx') && 'shielding',
    mark,
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <ShieldFx seat={seat} />
      <span className="ll-hd">
        <b>{seat.name}</b>
        {seat.bot && <i className="ll-chip bot">Bot</i>}
        <StatusIcons seat={seat} />
      </span>
      <span className="ll-seat-row">
        <span
          className="ll-backs"
          style={{ '--tot': Math.max(1, seat.eliminated ? 0 : seat.handCount) } as CSSProperties}
        >
          {!seat.eliminated &&
            Array.from({ length: seat.handCount }, (_, i) => (
              <CardBack
                // biome-ignore lint/suspicious/noArrayIndexKey: reversos idénticos
                key={i}
                className={i >= seat.handCount - (seat.hiddenBacks ?? 0) ? 'll-pending' : ''}
              />
            ))}
        </span>
        <CardFan cards={seat.discards} hideLast={seat.hiddenDiscards} />
      </span>
      <span className="ll-seat-foot">
        <Tokens count={seat.tokens} total={toWin} />
        <span className="ll-lbl">{onOpen ? 'Ver detalle' : 'Descartes'}</span>
      </span>
    </>
  );
  if (!onOpen) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario
      <div
        className={cls}
        data-seat-id={seat.id}
        role="group"
        aria-label={seatLabel(seat, toWin, false)}
      >
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      data-seat-id={seat.id}
      onClick={onOpen}
      aria-label={seatLabel(seat, toWin)}
    >
      {body}
    </button>
  );
}

/** Tu propio cuadro: mismo orden que el de los rivales, sin la mano (esa se ve en grande). */
export function MineBar({
  seat,
  toWin,
  onOpen,
}: {
  seat: SeatData;
  toWin: number;
  onOpen?: () => void;
}) {
  const cls = [
    'll-mine',
    seat.eliminated && 'out',
    seat.isTurn && 'turnof',
    (seat.shield === 'fx' || seat.eye === 'fx') && 'shielding',
  ]
    .filter(Boolean)
    .join(' ');
  const label = `Tus descartes: ${seat.discards.length ? seat.discards.length : 'ninguno'}. ${seat.tokens} de ${toWin} fichas.${onOpen ? ' Ver detalle' : ''}`;
  const body = (
    <>
      <ShieldFx seat={seat} />
      <span className="ll-hd">
        <b>Tus descartes</b>
        <StatusIcons seat={seat} />
      </span>
      <span className="ll-seat-row">
        <CardFan cards={seat.discards} hideLast={seat.hiddenDiscards} />
      </span>
      <span className="ll-seat-foot">
        <Tokens count={seat.tokens} total={toWin} />
        <span className="ll-lbl">{onOpen ? 'Ver detalle' : 'Descartes'}</span>
      </span>
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
