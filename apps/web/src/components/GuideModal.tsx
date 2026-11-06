import { BAG_ART, CARDS, TOKENS_TO_WIN } from '../lib/cards';
import type { CardCounts } from '../lib/counts';
import { CardIcon } from './icons';
import { Sheet } from './Sheet';

export function GuideModal({
  players,
  counts,
  onClose,
}: {
  players?: number;
  counts?: CardCounts;
  onClose: () => void;
}) {
  return (
    <Sheet
      label="Carta guía"
      title="Carta guía"
      sub={
        counts
          ? 'Quedan = copias que no ves: descartes de todos, tu mano y las boca arriba ya descontados'
          : '21 cartas · en tu turno robas 1 y juegas 1'
      }
      onClose={onClose}
      wide
    >
      <ol className="ll-glist">
        {CARDS.map((c) => (
          <li key={c.value}>
            <span className="gv">{c.value}</span>
            <span className="gi">
              <CardIcon value={c.value} />
            </span>
            <div>
              <b>{c.name}</b> <i>×{c.copies}</i>
              {counts && (
                <i className={`lf ${counts[c.value].left === 0 ? 'zero' : 'some'}`}>
                  {' '}
                  · a la vista {counts[c.value].seen} · quedan {counts[c.value].left}
                </i>
              )}
              <p>{c.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="ll-gnote">
        <div className="ll-bagrow">
          <img
            className="ll-bag"
            src={BAG_ART}
            alt=""
            width={280}
            height={210}
            loading="lazy"
            decoding="async"
            onError={(e) => e.currentTarget.remove()}
          />
          <p>
            <b>Fichas para ganar.</b> 2 jugadores: 6 · 3 jugadores: 5 · 4 jugadores: 4 · 5 o 6
            jugadores: 3.
            {players ? ` Ahora: ${players} jugadores, ${TOKENS_TO_WIN[players]} fichas.` : ''}
          </p>
        </div>
        <p>
          <b>Fin de ronda.</b> Cuando queda un solo jugador o se acaba el mazo. Gana la mano más
          alta; si empatan, la mayor suma de descartes. Si solo un jugador que sigue en juego jugó
          un Espía, gana 1 ficha extra.
        </p>
        <p>
          <b>Preparación.</b> Se aparta 1 carta boca abajo; con 2 jugadores, además 3 boca arriba.
        </p>
      </div>
    </Sheet>
  );
}
