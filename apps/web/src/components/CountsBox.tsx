import { useState } from 'react';
import { CARDS, type CardValue } from '../lib/cards';
import type { CardCounts } from '../lib/counts';
import { CardFan } from './Card';

function startsOpen(): boolean {
  try {
    return window.matchMedia('(min-width: 640px)').matches;
  } catch {
    return true;
  }
}

/**
 * "Cuentas" dentro de las ventanas de decisión: cuántas copias de cada carta quedan por aparecer,
 * tus descartes y tu mano. Plegable (cerrado por omisión en móvil) para no alargar la ventana.
 */
export function CountsBox({
  counts,
  discards,
  hand,
  showCounts = true,
}: {
  counts: CardCounts;
  discards: readonly CardValue[];
  hand: readonly CardValue[];
  /** Con `false` solo se muestran tus descartes y tu mano (el Guardia ya lleva los contadores). */
  showCounts?: boolean;
}) {
  const [open] = useState(startsOpen);
  return (
    <details className="ll-counts" open={open}>
      <summary>Cuentas{showCounts ? ': quedan por aparecer' : ': tus descartes y tu mano'}</summary>
      {showCounts && (
        <ul className="ll-counts-grid" aria-label="Cartas que quedan por aparecer">
          {CARDS.map((c) => {
            const n = counts[c.value];
            return (
              <li key={c.value} className={n.left === 0 ? 'zero' : 'some'}>
                <b>{c.value}</b> {c.name}{' '}
                <span>
                  quedan {n.left} de {n.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="ll-counts-row">
        <span className="ll-lbl">Tus descartes</span>
        {discards.length ? <CardFan cards={discards} wrap /> : <span>ninguno</span>}
      </div>
      <div className="ll-counts-row">
        <span className="ll-lbl">Tu mano</span>
        {hand.length ? <CardFan cards={hand} wrap /> : <span>sin cartas</span>}
      </div>
    </details>
  );
}
