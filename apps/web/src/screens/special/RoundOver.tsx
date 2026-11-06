import type { CardValue, PlayerView, RoundSummary } from '@loveletter/engine';
import { Card } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { Tokens } from '../../components/Token';
import { cardName } from '../../lib/cards';
import { listNames, roundVerdict } from '../../lib/chronicle';

/** Nombre de un jugador; "Tú" para ti. */
export function nameFn(game: PlayerView) {
  return (id: string) =>
    id === game.you.id ? 'Tú' : (game.players.find((p) => p.id === id)?.name ?? '¿?');
}

/** Textos de la vista: nombres reales y segunda persona cuando eres tú. */
export function verdictFor(game: PlayerView, summary: RoundSummary) {
  return roundVerdict(summary, {
    me: game.you.id,
    name: (id) => game.players.find((p) => p.id === id)?.name ?? '¿?',
  });
}

export function summaryTitle(game: PlayerView, summary: RoundSummary): string {
  return verdictFor(game, summary).title;
}

/** La carta apartada: un dato discreto, en una línea; al pasar el cursor o enfocar se amplía. */
function SetAsideNote({ value }: { value: CardValue }) {
  const label = `Carta apartada: ${cardName(value)}`;
  return (
    <section aria-label="Carta apartada" className="ll-aside-row">
      <button type="button" className="ll-aside" title="Ampliar">
        <Card value={value} size="sm" ariaLabel={label} />
        <span className="ll-aside-pop" aria-hidden="true">
          <Card value={value} ariaLabel="" />
        </span>
      </button>
      <span className="ll-lbl" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>
        {label}
      </span>
    </section>
  );
}

/** Resumen de la ronda: motivo, manos reveladas, fichas, bonificación del Espía y carta apartada. */
export function RoundSummaryBody({ game, summary }: { game: PlayerView; summary: RoundSummary }) {
  const name = nameFn(game);
  const verdict = verdictFor(game, summary);
  const hands = summary.revealedHands ? Object.entries(summary.revealedHands) : [];
  return (
    <div className="grid gap-3">
      <p className="ll-rtxt">
        {verdict.reason}
        {verdict.bonus ? ` ${verdict.bonus}` : ''}
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
      {/* Falta en salas creadas antes de que el motor la guardara: entonces no se muestra nada. */}
      {summary.setAside !== undefined && summary.setAside !== null && (
        <SetAsideNote value={summary.setAside} />
      )}
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
      title={summaryTitle(game, summary)}
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
