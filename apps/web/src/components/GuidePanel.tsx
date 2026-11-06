import { CARDS } from '../lib/cards';

/** Carta guía lateral: resumen de las 10 cartas; al pulsarla se abre ampliada. */
export function GuidePanel({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="ll-guide" onClick={onOpen} aria-label="Carta guía: ampliar">
      <h4>Carta guía</h4>
      <ol>
        {CARDS.map((c) => (
          <li key={c.value}>
            <b>{c.value}</b>
            <span className="n">{c.name}</span>
            <span className="q">×{c.copies}</span>
            <small>{c.short}</small>
          </li>
        ))}
      </ol>
      <span className="zoom">Toca para ampliar</span>
    </button>
  );
}
