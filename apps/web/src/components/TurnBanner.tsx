import type { ReactNode } from 'react';

/** Centro de la mesa: ronda, de quién es el turno y meta de fichas. */
export function TurnBanner({
  round,
  text,
  toWin,
  mine = false,
  extra,
}: {
  round: number;
  text: string;
  toWin: number;
  /** Es tu turno: se resalta. */
  mine?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className={`ll-turn${mine ? ' mine' : ''}`}>
      Ronda {round}
      <small>
        {text} · meta {toWin} fichas
      </small>
      {extra && <small className="net">{extra}</small>}
    </div>
  );
}
