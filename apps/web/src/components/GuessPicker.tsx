import type { ReactNode } from 'react';
import { type CardValue, cardName, GUESSABLE_VALUES } from '../lib/cards';
import { type PickerPlayer, PlayerPickerModal } from './PlayerPickerModal';

/** Botones para nombrar una carta (todas menos el Guardia). */
export function GuessPicker({
  selected,
  onSelect,
  disabled = false,
  left,
}: {
  selected: CardValue | null;
  onSelect: (v: CardValue) => void;
  disabled?: boolean;
  /** Copias que quedan por aparecer de cada carta. Con 0 el botón se atenúa pero sigue activo. */
  left?: Partial<Record<CardValue, number>>;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario
    <div className="ll-guess" role="group" aria-label="Carta que nombras">
      {GUESSABLE_VALUES.map((v) => (
        <button
          key={v}
          type="button"
          className={`ll-gbtn${left?.[v] === 0 ? ' zero' : ''}`}
          aria-pressed={selected === v}
          disabled={disabled}
          onClick={() => onSelect(v)}
        >
          <b>{v}</b>
          <span>{cardName(v)}</span>
          {left?.[v] !== undefined && (
            <em>
              quedan {left[v]}
              {left[v] === 0 && (
                <span className="sr-only-ll">: ya están a la vista todas las copias</span>
              )}
            </em>
          )}
        </button>
      ))}
    </div>
  );
}

/** Guardia: elegir jugador y carta en una sola ventana. */
export function GuardModal({
  players,
  toWin,
  targetId,
  guess,
  onTarget,
  onGuess,
  onAccuse,
  onCancel,
  left,
  info,
}: {
  /** Copias por aparecer de cada carta (ver `cardCounts`). */
  left?: Partial<Record<CardValue, number>>;
  /** Recuadro de cuentas bajo los botones. */
  info?: ReactNode;
  players: readonly PickerPlayer[];
  toWin: number;
  targetId: string | null;
  guess: CardValue | null;
  onTarget: (id: string) => void;
  onGuess: (v: CardValue) => void;
  onAccuse: () => void;
  onCancel: () => void;
}) {
  const target = players.find((p) => p.id === targetId);
  const ready = Boolean(target) && guess !== null;
  return (
    <PlayerPickerModal
      card={1}
      players={players}
      toWin={toWin}
      selectedId={targetId}
      onPick={onTarget}
      onCancel={onCancel}
      footer={
        <button type="button" className="ll-play" disabled={!ready} onClick={onAccuse}>
          {ready && target && guess !== null
            ? `Acusar a ${target.name}: ${cardName(guess)}`
            : 'Acusar'}
        </button>
      }
    >
      <span className="ll-lbl">
        {target ? `¿Qué carta crees que tiene ${target.name}?` : 'Primero elige un jugador'}
      </span>
      <GuessPicker selected={guess} onSelect={onGuess} disabled={!target} left={left} />
      {guess !== null && left?.[guess] === 0 && (
        <span className="ll-lbl" role="status" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Ya están a la vista todas las copias de {cardName(guess)}: no puede tenerla. Puedes
          nombrarla igualmente.
        </span>
      )}
      {info}
      <span className="ll-lbl">No puedes nombrar Guardia. Si fallas, nadie ve su carta.</span>
    </PlayerPickerModal>
  );
}
