import { type CardValue, cardName, GUESSABLE_VALUES } from '../lib/cards';
import { type PickerPlayer, PlayerPickerModal } from './PlayerPickerModal';

/** Botones para nombrar una carta (todas menos el Guardia). */
export function GuessPicker({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: CardValue | null;
  onSelect: (v: CardValue) => void;
  disabled?: boolean;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario
    <div className="ll-guess" role="group" aria-label="Carta que nombras">
      {GUESSABLE_VALUES.map((v) => (
        <button
          key={v}
          type="button"
          className="ll-gbtn"
          aria-pressed={selected === v}
          disabled={disabled}
          onClick={() => onSelect(v)}
        >
          <b>{v}</b>
          <span>{cardName(v)}</span>
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
}: {
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
      <GuessPicker selected={guess} onSelect={onGuess} disabled={!target} />
      <span className="ll-lbl">No puedes nombrar Guardia. Si fallas, nadie ve su carta.</span>
    </PlayerPickerModal>
  );
}
