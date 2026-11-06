import { CARD_BY_VALUE, type CardValue } from '../lib/cards';
import { agree, type Gender } from '../lib/gender';
import { plural } from '../lib/names';
import { Card } from './Card';
import { Sheet } from './Sheet';

/** Descartes de un jugador, de la más antigua a la más reciente, con el efecto de cada carta. */
export function DiscardsModal({
  name,
  gender,
  discards,
  eliminated,
  protectedNow,
  spyPlayed,
  onClose,
}: {
  name: string;
  gender?: Gender;
  discards: readonly CardValue[];
  eliminated?: boolean;
  protectedNow?: boolean;
  spyPlayed?: boolean;
  onClose: () => void;
}) {
  const last = discards.length - 1;
  const notes = [
    eliminated && agree('Eliminado', gender),
    protectedNow && `${agree('Protegido', gender)} hasta su próximo turno`,
    spyPlayed && 'Jugó un Espía',
  ].filter(Boolean);
  const caption = (i: number) =>
    i === last
      ? eliminated
        ? `Con esta quedó ${agree('eliminado', gender)}`
        : 'Más reciente'
      : `Jugada ${i + 1}`;
  return (
    <Sheet
      label={`Descartes de ${name}`}
      title={`Descartes de ${name}`}
      sub={`${plural(discards.length, 'carta', 'cartas')} · de la más antigua a la más reciente${notes.length ? ` · ${notes.join(' · ')}` : ''}`}
      onClose={onClose}
    >
      {discards.length === 0 ? (
        <p className="ll-rtxt">Todavía no ha descartado nada.</p>
      ) : (
        <div className="ll-dgrid">
          {discards.map((v, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista ordenada
            <div key={`${i}-${v}`} className="ll-dwrap">
              <Card value={v} />
              <span className="ll-cfx">{CARD_BY_VALUE[v].text}</span>
              <span className="ll-lbl">{caption(i)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
