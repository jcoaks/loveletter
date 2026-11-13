import type { ReactNode } from 'react';
import { type CardValue, cardName } from '../lib/cards';
import { agree, type Gender } from '../lib/gender';
import { labelName, plural } from '../lib/names';
import { CardFan } from './Card';
import { Sheet } from './Sheet';
import { Tokens } from './Token';

export interface PickerPlayer {
  id: string;
  name: string;
  gender?: Gender;
  isMe?: boolean;
  eligible: boolean;
  /** Por qué no es elegible, si se sabe. Por omisión se infiere de `eliminated`. */
  eliminated?: boolean;
  discards: readonly CardValue[];
  tokens: number;
}

const PROMPT: Partial<Record<CardValue, string>> = {
  1: 'Elige a quién acusar',
  2: 'Elige de quién mirar la mano',
  3: 'Elige con quién comparar manos',
  5: 'Elige quién descarta su mano y roba',
  7: 'Elige con quién intercambiar manos',
};
const SUB: Partial<Record<CardValue, string>> = {
  1: 'Acusarlo de tener una carta',
  2: 'Ver su mano',
  3: 'Comparar manos',
  5: 'Descarta su mano y roba',
  7: 'Intercambiar manos',
};

/**
 * Elegir jugador para una carta con objetivo. Sin `selectedId` elegir es inmediato (`onPick`);
 * con `selectedId` (incluido `null`) las fichas son conmutables y el dueño confirma aparte
 * (p. ej. el Guardia, que además pide una carta).
 */
export function PlayerPickerModal({
  card,
  players,
  toWin,
  selectedId,
  onPick,
  onCancel,
  locked = false,
  restCard,
  children,
  footer,
}: {
  card: CardValue;
  players: readonly PickerPlayer[];
  toWin: number;
  selectedId?: string | null;
  onPick: (id: string) => void;
  /** Sin `onCancel` la jugada ya está declarada: no hay vuelta atrás (ni botón, ni Escape). */
  onCancel?: () => void;
  /** El objetivo ya se anunció: no se puede cambiar. */
  locked?: boolean;
  /** La otra carta de tu mano: se muestra al elegirte con el Príncipe. */
  restCard?: CardValue;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const prince = card === 5;
  const selectable = selectedId !== undefined;
  const name = cardName(card);
  return (
    <Sheet
      label={`Elegir jugador: ${name}`}
      title={name}
      sub={`${PROMPT[card] ?? 'Elige un jugador'}. Protegidos y eliminados no se pueden elegir.${prince ? ' Puedes elegirte; si el elegido descarta la Princesa, queda fuera.' : ''}`}
      onClose={onCancel}
      footer={
        <>
          {onCancel && (
            <button type="button" className="ll-ghost" onClick={onCancel}>
              Cancelar
            </button>
          )}
          {footer}
        </>
      }
    >
      <div className="ll-ptiles">
        {/* Los rivales conservan su orden; si no puedes elegirte, tu cuadro va al final, deshabilitado. */}
        {(prince
          ? players
          : [...players.filter((p) => !p.isMe), ...players.filter((p) => p.isMe)]
        ).map((p) => {
          const sub = p.isMe
            ? !prince
              ? 'No puedes elegirte'
              : restCard === undefined
                ? 'Descartas tu mano y robas'
                : `Descartas ${cardName(restCard)} y robas`
            : p.eligible
              ? (SUB[card] ?? '')
              : agree(p.eliminated ? 'Eliminado' : 'Protegido', p.gender);
          const inner = (
            <>
              <b>{labelName(p.name, p.isMe)}</b>
              <span className="ll-lbl">{sub}</span>
              <span className="ll-lbl">
                {p.discards.length === 0
                  ? 'Sin descartes'
                  : plural(p.discards.length, 'descarte', 'descartes')}
              </span>
              <CardFan cards={p.discards} wrap />
              <Tokens count={p.tokens} total={toWin} />
            </>
          );
          const frozen = locked && selectedId !== p.id;
          return p.eligible && (prince || !p.isMe) ? (
            <button
              key={p.id}
              type="button"
              className={`ll-ptile${p.isMe ? ' me' : ''}${frozen ? ' off' : ''}`}
              aria-pressed={selectable ? selectedId === p.id : undefined}
              aria-disabled={locked || undefined}
              onClick={locked ? undefined : () => onPick(p.id)}
            >
              {inner}
            </button>
          ) : (
            <button key={p.id} type="button" className="ll-ptile off" aria-disabled="true">
              {inner}
            </button>
          );
        })}
      </div>
      {children}
    </Sheet>
  );
}
