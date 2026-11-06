import type { ReactNode } from 'react';
import type { CardValue } from '../lib/cards';
import { Card } from './Card';
import { Sheet } from './Sheet';

export interface ResultFace {
  caption: string;
  value: CardValue;
}

/** Resultado de una jugada, con etiqueta Privado / Público. */
export function ResultModal({
  label,
  title,
  body,
  faces = [],
  visibility,
  hit = false,
  onContinue,
}: {
  label: string;
  title: ReactNode;
  body: ReactNode;
  faces?: readonly ResultFace[];
  visibility: 'private' | 'public';
  /** Alguien quedó fuera: borde de alerta. */
  hit?: boolean;
  onContinue: () => void;
}) {
  return (
    <Sheet
      label={label}
      title={title}
      sub={
        <i className="ll-chip">
          {visibility === 'private' ? 'Privado · solo tú lo ves' : 'Público · todos lo ven'}
        </i>
      }
      tone={hit ? 'hit' : 'default'}
      footer={
        <button type="button" className="ll-play" onClick={onContinue}>
          Continuar
        </button>
      }
    >
      <p className="ll-rtxt">{body}</p>
      {faces.length > 0 && (
        <div className="ll-faces">
          {faces.map((f) => (
            <div key={`${f.caption}-${f.value}`} className="ll-dwrap">
              <Card value={f.value} size="sm" />
              <span className="ll-lbl">{f.caption}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
