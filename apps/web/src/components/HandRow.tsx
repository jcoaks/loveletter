import { type CardValue, isLockedByCountess } from '../lib/cards';
import { Card } from './Card';

/** Mano propia (cartas grandes). Las bloqueadas por la Condesa se marcan, no se ocultan. */
export function HandRow({
  hand,
  selected,
  onSelect,
  disabled = false,
  waiting = false,
  emptyText = 'Sin cartas: quedaste fuera de la ronda',
  lockedValues,
}: {
  hand: readonly CardValue[];
  selected?: CardValue | null;
  onSelect?: (v: CardValue) => void;
  disabled?: boolean;
  /** No es tu turno: la mano se atenúa. */
  waiting?: boolean;
  emptyText?: string;
  /** Valores bloqueados según el motor (`legalPlays`); sin esto se deduce de la Condesa. */
  lockedValues?: ReadonlySet<CardValue>;
}) {
  return (
    <div className={`ll-hand${waiting ? ' wait' : ''}`}>
      {hand.length === 0 ? (
        <span className="ll-lbl">{emptyText}</span>
      ) : (
        hand.map((v, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: la mano puede repetir valores
            key={`${i}-${v}`}
            value={v}
            eager
            selected={selected === v}
            locked={lockedValues ? lockedValues.has(v) : isLockedByCountess(hand, v)}
            disabled={disabled}
            onClick={onSelect ? () => onSelect(v) : undefined}
          />
        ))
      )}
    </div>
  );
}
