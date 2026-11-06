import type { PlayerView } from '@loveletter/engine';
import type { RoomView } from '@loveletter/protocol';
import { Sheet } from '../../components/Sheet';
import { Tokens } from '../../components/Token';
import { listNames } from '../../lib/chronicle';
import { labelName } from '../../lib/names';
import { useUiStore } from '../../store/ui';
import { nameFn, RoundSummaryBody } from './RoundOver';

/** Fin de partida: podio con fichas, ganador(es), nueva partida (anfitrión) y salir. */
export function GameOverModal({
  game,
  room,
  onNewGame,
  onHide,
  disabled,
}: {
  game: PlayerView;
  room: RoomView;
  onNewGame: () => void;
  onHide: () => void;
  disabled?: boolean;
}) {
  const name = nameFn(game);
  const winners = game.winnerIds.length ? game.winnerIds : (game.summary?.gameWinnerIds ?? []);
  const ranking = [...game.players].sort((a, b) => b.tokens - a.tokens || a.seat - b.seat);
  const farewells = room.chat.filter((c) => c.final);
  const title =
    winners.length > 1
      ? winners.includes(game.you.id)
        ? `Empate: tú y ${listNames(winners.filter((id) => id !== game.you.id).map(name))} ganan la partida`
        : `Empate: ganan ${listNames(winners.map(name))}`
      : winners[0] === game.you.id
        ? '¡Ganaste la partida!'
        : `¡${name(winners[0] ?? '')} gana la partida!`;
  const openDialog = useUiStore((s) => s.openDialog);
  return (
    <Sheet
      label="Fin de la partida"
      title={title}
      sub="Fin de la partida"
      onClose={onHide}
      wide
      tone="hit"
      footer={
        <>
          <button type="button" className="ll-ghost" onClick={onHide}>
            Ver la mesa
          </button>
          <button type="button" className="ll-ghost" onClick={() => openDialog('leave')}>
            Salir de la sala
          </button>
          {room.you.isHost ? (
            <button type="button" className="ll-play" disabled={disabled} onClick={onNewGame}>
              Nueva partida
            </button>
          ) : (
            <span className="ll-lbl self-center">Esperando al anfitrión para otra partida</span>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <img
          src="/assets/princess.webp"
          alt=""
          width={330}
          height={460}
          loading="lazy"
          decoding="async"
          className="h-auto w-[min(130px,30vw)]"
        />
        <ol className="m-0 grid min-w-[220px] flex-1 list-none gap-2 p-0" aria-label="Podio">
          {ranking.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/30 px-3 py-2"
            >
              <span>
                <b className="font-display">{i + 1}. </b>
                <b className="font-display tracking-wider">
                  {labelName(p.name, p.id === game.you.id)}
                </b>
                {winners.includes(p.id) && <i className="ll-chip on ml-2">Ganador</i>}
              </span>
              <Tokens count={p.tokens} total={game.tokensToWin} />
            </li>
          ))}
        </ol>
      </div>
      {game.summary && <RoundSummaryBody game={game} summary={game.summary} />}
      {farewells.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {farewells.map((c) => (
            <li key={c.id} className="ll-lbl" style={{ textTransform: 'none', fontSize: 15 }}>
              <b>{name(c.playerId)}:</b> “{c.text}”
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
