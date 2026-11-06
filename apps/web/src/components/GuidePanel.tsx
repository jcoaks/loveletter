import { CARDS } from '../lib/cards';
import type { CardCounts } from '../lib/counts';

/** Carta guía lateral: resumen de las 10 cartas; al pulsarla se abre ampliada. */
export function GuidePanel({
  onOpen,
  counts,
}: {
  onOpen: () => void;
  /** Copias a la vista y por aparecer (ver `cardCounts`). */
  counts?: CardCounts;
}) {
  return (
    <button type="button" className="ll-guide" onClick={onOpen} aria-label="Carta guía: ampliar">
      <h4>Carta guía</h4>
      <ol>
        {CARDS.map((c) => (
          <li key={c.value}>
            <b>{c.value}</b>
            <span className="n">{c.name}</span>
            <span className="q">
              ×{c.copies}
              {counts && (
                <i className={`lf ${counts[c.value].left === 0 ? 'zero' : 'some'}`}>
                  {' '}
                  · quedan {counts[c.value].left}
                </i>
              )}
            </span>
            <small>{c.short}</small>
          </li>
        ))}
      </ol>
      <span className="zoom">Toca para ampliar</span>
    </button>
  );
}
