import type { CardValue, PlayerView, RoundSummary } from '@loveletter/engine';
import { Card } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { Tokens } from '../../components/Token';
import { cardName } from '../../lib/cards';
import { listNames, reasonText } from '../../lib/chronicle';

/** Nombre de un jugador; "Tú" para ti. */
export function nameFn(game: PlayerView) {
  return (id: string) =>
    id === game.you.id ? 'Tú' : (game.players.find((p) => p.id === id)?.name ?? '¿?');
}

export function summaryTitle(summary: RoundSummary, name: (id: string) => string): string {
  const names = summary.winnerIds.map(name);
  if (summary.reason === 'shared_tie') return `Empate: ganan ${listNames(names)}`;
  return names.length > 1 ? `Ganan la ronda ${listNames(names)}` : `Gana la ronda ${names[0]}`;
}

/** La carta apartada al empezar la ronda, que gira de reverso a cara. */
function SetAsideReveal({ value }: { value: CardValue }) {
  return (
    <section
      aria-label="Carta apartada"
      className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-gold/30 bg-black/20 p-3"
    >
      <div className="ll-faces big compact" data-n={1}>
        <div className="ll-dwrap">
          <div className="ll-flip">
            <div className="ll-flip-in">
              <span className="ll-flip-back" aria-hidden="true" />
              <Card value={value} ariaLabel={`Carta apartada: ${cardName(value)}`} />
            </div>
          </div>
        </div>
      </div>
      <div className="min-w-[160px] flex-1">
        <h4 className="m-0 font-display text-lg tracking-wider">Carta apartada</h4>
        <p className="m-0 mt-1 text-ivory/85">La que se apartó boca abajo al empezar la ronda</p>
      </div>
    </section>
  );
}

/** Resumen de la ronda: ganador, motivo, manos reveladas, fichas y bonificación del Espía. */
export function RoundSummaryBody({ game, summary }: { game: PlayerView; summary: RoundSummary }) {
  const name = nameFn(game);
  const hands = summary.revealedHands ? Object.entries(summary.revealedHands) : [];
  return (
    <div className="grid gap-3">
      <p className="ll-rtxt">
        {summary.winnerIds.map(name).join(', ')}: {reasonText(summary)}.
        {summary.spyBonusId !== null &&
          ` ${name(summary.spyBonusId)} gana 1 ficha extra por el Espía.`}
      </p>
      {hands.length > 0 && (
        <div className="ll-faces big compact" data-n={hands.length}>
          {hands.map(([id, value]) => (
            <div key={id} className="ll-dwrap">
              <Card value={value} ariaLabel={`${name(id)}: ${cardName(value)}`} />
              <span className="ll-lbl">{name(id)}</span>
            </div>
          ))}
        </div>
      )}
      {/* Falta en salas creadas antes de que el motor la guardara: entonces no se muestra nada. */}
      {summary.setAside !== undefined && summary.setAside !== null && (
        <SetAsideReveal value={summary.setAside} />
      )}
      {summary.discardTotals && (
        <p className="ll-lbl" style={{ margin: 0 }}>
          Suma de descartes:{' '}
          {Object.entries(summary.discardTotals)
            .map(([id, total]) => `${name(id)} ${total}`)
            .join(' · ')}
        </p>
      )}
      <ul className="m-0 grid list-none gap-2 p-0" aria-label="Fichas de afecto">
        {game.players.map((p) => {
          const gained = summary.awarded[p.id] ?? 0;
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <b className="font-display tracking-wider">{name(p.id)}</b>
              <span className="flex items-center gap-2">
                <Tokens count={summary.tokens[p.id] ?? p.tokens} total={game.tokensToWin} />
                {gained > 0 && <i className="ll-chip on">+{gained}</i>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RoundOverModal({
  game,
  onContinue,
  onHide,
  disabled,
}: {
  game: PlayerView;
  onContinue: () => void;
  onHide: () => void;
  disabled?: boolean;
}) {
  const summary = game.summary;
  const over = game.roundOver;
  if (!summary || !over) return null;
  const name = nameFn(game);
  const waiting = over.waitingFor.map(name);
  return (
    <Sheet
      label={`Fin de la ronda ${summary.round}`}
      title={summaryTitle(summary, name)}
      sub={`Fin de la ronda ${summary.round} · público`}
      onClose={onHide}
      wide
      footer={
        <>
          <button type="button" className="ll-ghost" onClick={onHide}>
            Ver la mesa
          </button>
          <button
            type="button"
            className="ll-play"
            disabled={over.youReady || disabled}
            onClick={onContinue}
          >
            {over.youReady ? 'Listo' : 'Continuar'}
          </button>
        </>
      }
    >
      <RoundSummaryBody game={game} summary={summary} />
      <p className="ll-lbl" role="status" style={{ margin: 0 }}>
        {over.youReady && waiting.length > 0 ? `Esperando a ${listNames(waiting)}…` : ' '}
      </p>
    </Sheet>
  );
}
