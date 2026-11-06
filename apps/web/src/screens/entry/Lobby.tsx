import { formatRoomCode, type RoomPlayer, type RoomView } from '@loveletter/protocol';
import { useState } from 'react';
import { LogoLockup } from '../../components/LogoLockup';
import { ReadySeal } from '../../components/ReadySeal';
import { RulesModal } from '../../components/RulesContent';
import { useCanAct, useRoom } from '../../hooks/room';
import { TOKENS_TO_WIN } from '../../lib/cards';
import { useRoomStore } from '../../store/room';
import { useUiStore } from '../../store/ui';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Sala de espera: invitación, quién está sentado, bots, listo e inicio. */
export function LobbyScreen() {
  const room = useRoom();
  const send = useRoomStore((s) => s.send);
  const canAct = useCanAct();
  const openDialog = useUiStore((s) => s.openDialog);
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const you = room.players.find((p) => p.id === room.you.id);
  const { minPlayers, maxPlayers } = room.limits;
  const count = room.players.length;
  const readyCount = room.players.filter((p) => p.ready || p.bot).length;
  const goal = TOKENS_TO_WIN[count];
  const startLabel =
    count < minPlayers
      ? `Faltan jugadores (mínimo ${minPlayers})`
      : room.canStart
        ? 'Comenzar la partida'
        : 'Esperando a que todos estén listos';

  return (
    <main className="mx-auto grid max-w-[1000px] gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <LogoLockup height={36} />
        <div className="flex items-center gap-2">
          <button type="button" className="ll-ghost" onClick={() => openDialog('rules')}>
            Reglas
          </button>
          <button type="button" className="ll-ghost" onClick={() => openDialog('leave')}>
            Salir
          </button>
        </div>
      </header>

      <div className="flex items-center gap-4">
        <h1 className="m-0 font-display text-3xl tracking-wider">La mesa espera</h1>
        <img
          src="/assets/princess.webp"
          alt=""
          width={330}
          height={460}
          loading="lazy"
          decoding="async"
          className="hidden h-24 w-auto opacity-90 sm:block"
        />
      </div>
      <InviteCard code={room.code} />

      <section className="grid gap-3" aria-labelledby="h-jug">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 id="h-jug" className="m-0 font-display text-xl tracking-wider">
            Jugadores · {count} de {maxPlayers}
          </h2>
          <span className="ll-lbl" aria-live="polite">
            {readyCount} de {count} listos
          </span>
        </div>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {room.players.map((p) => (
            <PlayerRow key={p.id} player={p} room={room} canAct={canAct} />
          ))}
          {room.you.isHost && count < maxPlayers && (
            <li className="flex">
              <button
                type="button"
                className="ll-ghost flex-1"
                style={{ borderStyle: 'dashed', minHeight: 64 }}
                disabled={!canAct}
                onClick={() => send({ type: 'configure', config: { bots: room.config.bots + 1 } })}
              >
                + Añadir un bot
              </button>
            </li>
          )}
        </ul>
        <p className="m-0 text-ivory/80">
          De {minPlayers} a {maxPlayers} jugadores.{' '}
          {goal
            ? `Con ${count} jugadores se gana con ${goal} fichas de afecto.`
            : 'Hacen falta al menos 2 jugadores para empezar.'}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {you && !you.bot && (
          <button
            type="button"
            className={you.ready ? 'll-play' : 'll-ghost'}
            aria-pressed={you.ready}
            disabled={!canAct}
            onClick={() => send({ type: 'set_ready', ready: !you.ready })}
          >
            {you.ready ? 'Estoy listo' : '¿Listo para jugar?'}
          </button>
        )}
        {room.you.isHost ? (
          <button
            type="button"
            className="ll-play"
            disabled={!room.canStart || !canAct}
            onClick={() => send({ type: 'start' })}
          >
            {startLabel}
          </button>
        ) : (
          <p className="m-0 self-center text-ivory/80">
            El anfitrión comenzará la partida cuando todos estén listos.
          </p>
        )}
      </div>
      {dialog === 'rules' && <RulesModal onClose={closeDialog} />}
    </main>
  );
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<'idle' | 'link' | 'code' | 'fail'>('idle');
  const formatted = formatRoomCode(code);
  const link = `${window.location.origin}/sala/${formatted}`;
  async function copy(what: 'link' | 'code') {
    const ok = await copyText(what === 'link' ? link : formatted);
    setCopied(ok ? what : 'fail');
    window.setTimeout(() => setCopied('idle'), 2500);
  }
  return (
    <div className="ll-panel flex flex-wrap items-center gap-4">
      <div className="flex-[1_1_200px]">
        <span className="ll-lbl">Código de sala</span>
        <div className="font-display text-4xl tracking-[0.12em] text-gold-light">{formatted}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ll-ghost" onClick={() => copy('link')}>
          {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <button type="button" className="ll-ghost" onClick={() => copy('code')}>
          {copied === 'code' ? 'Código copiado' : 'Copiar código'}
        </button>
      </div>
      <span role="status" className="ll-err basis-full empty:hidden">
        {copied === 'fail' ? `Cópialo a mano: ${link}` : ''}
      </span>
    </div>
  );
}

function PlayerRow({
  player,
  room,
  canAct,
}: {
  player: RoomPlayer;
  room: RoomView;
  canAct: boolean;
}) {
  const send = useRoomStore((s) => s.send);
  const isYou = player.id === room.you.id;
  const canRemove = room.you.isHost && !isYou;
  const status = player.bot
    ? 'Bot · siempre listo'
    : !player.connected
      ? 'Desconectado'
      : player.ready
        ? 'Listo'
        : 'Esperando';
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gold/30 bg-black/25 px-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display tracking-wider">
          {isYou ? `${player.name} (tú)` : player.name}
          {player.id === room.hostId && <i className="ll-chip on ml-2">Anfitrión</i>}
          {player.bot && <i className="ll-chip ml-2">Bot</i>}
        </span>
        <span
          className={`text-sm ${player.bot || player.ready ? 'text-ivory/75' : 'text-ivory/45'}`}
        >
          {status}
        </span>
      </span>
      <ReadySeal ready={player.bot || player.ready} fixed={player.bot} />
      {canRemove && (
        <button
          type="button"
          className="ll-x"
          style={{ width: 44, height: 44, fontSize: 22 }}
          disabled={!canAct}
          aria-label={`${player.bot ? 'Quitar' : 'Expulsar'} a ${player.name}`}
          onClick={() =>
            player.bot
              ? send({ type: 'configure', config: { bots: Math.max(0, room.config.bots - 1) } })
              : send({ type: 'kick', playerId: player.id })
          }
        >
          ×
        </button>
      )}
    </li>
  );
}
