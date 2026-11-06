import { useState } from 'react';
import { type CardValue, cardName } from '../lib/cards';
import { Card } from './Card';
import { Sheet } from './Sheet';

const PRIV = <i className="ll-chip">Privado · solo tú lo ves</i>;

export interface ChancellorChoice {
  keep: CardValue;
  /** Cartas al fondo del mazo: la primera en llegar va primero. */
  bottom: CardValue[];
}

/** Canciller: conservar 1 carta y ordenar el resto para el fondo del mazo (subir / bajar). */
export function ChancellorModal({
  options,
  onConfirm,
  onCancel,
}: {
  /** Tu mano más las cartas robadas. */
  options: readonly CardValue[];
  onConfirm: (choice: ChancellorChoice) => void;
  onCancel: () => void;
}) {
  const [keep, setKeep] = useState<number | null>(null);
  const [order, setOrder] = useState<CardValue[]>([]);

  const choose = (i: number) => {
    const rest = options.filter((_, j) => j !== i);
    const kept = options[i];
    if (kept === undefined) return;
    if (rest.length < 2) {
      onConfirm({ keep: kept, bottom: rest });
      return;
    }
    setKeep(i);
    setOrder(rest);
  };
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const next = [...o];
      const a = next[i];
      const b = next[i + d];
      if (a === undefined || b === undefined) return o;
      next[i] = b;
      next[i + d] = a;
      return next;
    });

  const kept = keep === null ? undefined : options[keep];
  if (kept === undefined) {
    return (
      <Sheet
        label="Canciller: elegir carta"
        title="Canciller: ¿qué carta conservas?"
        sub={<>{PRIV} Luego ordenas las otras para el fondo del mazo.</>}
        onClose={onCancel}
        footer={
          <button type="button" className="ll-ghost" onClick={onCancel}>
            Cancelar
          </button>
        }
      >
        <div className="ll-faces">
          {options.map((v, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: puede haber valores repetidos
            <div key={`${i}-${v}`} className="ll-dwrap">
              <Card
                value={v}
                className="opt"
                ariaLabel={`Conservar ${cardName(v)}`}
                onClick={() => choose(i)}
              />
              <span className="ll-lbl">{i === 0 ? 'Tu mano' : 'Robada'}</span>
            </div>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      label="Canciller: ordenar el fondo del mazo"
      title="Canciller: ordena el fondo del mazo"
      sub={
        <>
          {PRIV} Conservas {cardName(kept)}. Elige el orden en que las otras van al fondo.
        </>
      }
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="ll-ghost" onClick={() => setKeep(null)}>
            Cambiar carta
          </button>
          <button
            type="button"
            className="ll-play"
            onClick={() => onConfirm({ keep: kept, bottom: order })}
          >
            Confirmar orden
          </button>
        </>
      }
    >
      <ol
        className="ll-faces"
        aria-label="Orden al fondo del mazo"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {order.map((v, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: puede haber valores repetidos
          <li key={`${i}-${v}`} className="ll-dwrap">
            <Card value={v} />
            <span className="ll-lbl">
              {i === 0
                ? 'Primera al fondo'
                : i === order.length - 1
                  ? 'Última (al fondo del todo)'
                  : 'Siguiente'}
            </span>
            <span className="ll-row2" style={{ padding: 0 }}>
              <button
                type="button"
                className="ll-ghost"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Subir ${cardName(v)}`}
              >
                ▲ Subir
              </button>
              <button
                type="button"
                className="ll-ghost"
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Bajar ${cardName(v)}`}
              >
                ▼ Bajar
              </button>
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
