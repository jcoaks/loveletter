import { formatRoomCode, type RoomPlayer, type RoomView } from '@loveletter/protocol';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { LogoLockup } from '../../components/LogoLockup';
import { ReadySeal } from '../../components/ReadySeal';
import { RulesModal } from '../../components/RulesContent';
import { type ToastItem, ToastStack } from '../../components/ToastStack';
import { useCanAct, useRoom } from '../../hooks/room';
import { CARDS, TOKENS_TO_WIN } from '../../lib/cards';
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

const DECK_SIZE = CARDS.reduce((n, c) => n + c.copies, 0);

/** Avisos discretos cuando alguien se sienta o se levanta de la mesa (no al abrir la pantalla). */
function useTableToasts(players: readonly RoomPlayer[], youId: string) {
  const known = useRef<Map<string, RoomPlayer> | null>(null);
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const now = new Map(players.map((p) => [p.id, p]));
    const before = known.current;
    known.current = now;
    if (!before) return;
    const fresh: ToastItem[] = [];
    // Solo personas: los bots los añade el anfitrión y se ven en la mesa al instante.
    for (const [id, p] of now) {
      if (!before.has(id) && id !== youId && !p.bot)
        fresh.push({ key: `in-${id}`, body: `${p.name} se sentó a la mesa`, ms: 3500 });
    }
    for (const [id, p] of before) {
      if (!now.has(id) && !p.bot)
        fresh.push({ key: `out-${id}-${now.size}`, body: `${p.name} dejó la mesa`, ms: 3500 });
    }
    if (fresh.length) setItems((s) => [...s, ...fresh]);
  }, [players, youId]);
  return { items, dismiss: (key: string) => setItems((s) => s.filter((i) => i.key !== key)) };
}

/** Sala de espera: invitación, mesa de jugadores, ajustes del anfitrión, listo e inicio. */
export function LobbyScreen() {
  const room = useRoom();
  const send = useRoomStore((s) => s.send);
  const status = useRoomStore((s) => s.status);
  const canAct = useCanAct();
  const openDialog = useUiStore((s) => s.openDialog);
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const you = room.players.find((p) => p.id === room.you.id);
  const { minPlayers, maxPlayers } = room.limits;
  const count = room.players.length;
  const readyCount = room.players.filter((p) => p.ready || p.bot).length;
  const goal = TOKENS_TO_WIN[count];
  const toasts = useTableToasts(room.players, room.you.id);
  const waitingFor = room.players.filter((p) => !p.bot && !p.ready).map((p) => p.name);
  const startLabel =
    count < minPlayers
      ? `Faltan jugadores (mínimo ${minPlayers})`
      : room.canStart
        ? 'Comenzar la partida'
        : 'Esperando a que todos estén listos';
  const reason =
    count < minPlayers
      ? `Se necesitan al menos ${minPlayers} jugadores: invita a alguien o añade un bot.`
      : room.canStart
        ? 'Todo listo: cuando quieras, empieza.'
        : waitingFor.length > 0
          ? `Falta que marquen listo: ${waitingFor.join(', ')}.`
          : 'Esperando a que la sala esté lista.';
  const empty = Math.max(0, maxPlayers - count);
  const offline = status === 'reconnecting' || status === 'connecting';

  return (
    <main className="lb">
      <header className="lb-bar">
        <LogoLockup height={36} />
        <div className="lb-bar-btns">
          <button type="button" className="ll-ghost" onClick={() => openDialog('rules')}>
            Reglas
          </button>
          <button type="button" className="ll-danger" onClick={() => openDialog('leave')}>
            Salir
          </button>
        </div>
      </header>

      {offline && (
        <p className="lb-offline" role="status">
          Reconectando con la sala… Tus cambios se enviarán cuando vuelva la conexión.
        </p>
      )}

      <div className="lb-grid">
        <div className="lb-title">
          <div>
            <h1 className="m-0 font-display text-3xl tracking-wider">La mesa espera</h1>
            <p className="lb-count" aria-live="polite">
              <b className="lb-count-n">
                {count} de {maxPlayers}
              </b>{' '}
              jugadores{goal ? ` · meta de ${goal} fichas` : ''}
            </p>
          </div>
          <img
            src="/assets/princess.webp"
            alt=""
            width={330}
            height={460}
            loading="lazy"
            decoding="async"
            className="lb-princess"
          />
        </div>

        <InviteCard code={room.code} />

        <section className="lb-table" aria-labelledby="h-jug">
          <div className="lb-table-hd">
            <h2 id="h-jug" className="m-0 font-display text-xl tracking-wider">
              Jugadores · {count} de {maxPlayers}
            </h2>
            <span className="ll-lbl" aria-live="polite">
              {readyCount} de {count} listos
            </span>
          </div>
          <ul className="lb-seats">
            {room.players.map((p) => (
              <PlayerRow key={p.id} player={p} room={room} canAct={canAct} />
            ))}
            {Array.from({ length: empty }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: huecos idénticos
              <li key={i} className="lb-seat empty" style={{ '--i': i } as CSSProperties}>
                <span className="lb-avatar" aria-hidden="true" />
                <span className="lb-empty-txt">Esperando jugador…</span>
              </li>
            ))}
          </ul>
        </section>

        {room.you.isHost && (
          <section className="lb-host" aria-labelledby="h-host">
            <h2 id="h-host" className="lb-h">
              Ajustes de la mesa
            </h2>
            <div className="lb-stepper">
              <span id="bots-lbl" className="lb-stepper-lbl">
                Bots
                <small className="lb-stepper-sub">Completan la mesa y juegan solos</small>
              </span>
              {/* biome-ignore lint/a11y/useSemanticElements: grupo con nombre accesible, no un formulario */}
              <div className="lb-stepper-ctl" role="group" aria-labelledby="bots-lbl">
                <button
                  type="button"
                  className="ll-x lb-step"
                  aria-label="Quitar un bot"
                  disabled={!canAct || room.config.bots <= 0}
                  onClick={() =>
                    send({ type: 'configure', config: { bots: Math.max(0, room.config.bots - 1) } })
                  }
                >
                  −
                </button>
                <output className="lb-step-n" aria-live="polite">
                  {room.config.bots}
                </output>
                <button
                  type="button"
                  className="ll-x lb-step"
                  aria-label="Añadir un bot"
                  disabled={!canAct || count >= maxPlayers}
                  onClick={() =>
                    send({ type: 'configure', config: { bots: room.config.bots + 1 } })
                  }
                >
                  +
                </button>
              </div>
            </div>
            <p className="lb-sum">
              Mazo de {DECK_SIZE} cartas, edición con Espía y Canciller. De {minPlayers} a{' '}
              {maxPlayers} jugadores.{' '}
              {goal
                ? `Con ${count} jugadores se gana con ${goal} fichas de afecto.`
                : 'Hacen falta al menos 2 jugadores para empezar.'}
            </p>
          </section>
        )}
        {!room.you.isHost && (
          <p className="lb-sum lb-sum-guest">
            Mazo de {DECK_SIZE} cartas, edición con Espía y Canciller.{' '}
            {goal
              ? `Con ${count} jugadores se gana con ${goal} fichas de afecto.`
              : 'Hacen falta al menos 2 jugadores para empezar.'}
          </p>
        )}
        <div className="lb-cta ll-lobby-cta">
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
            <div className="lb-start">
              <button
                type="button"
                className="ll-play"
                disabled={!room.canStart || !canAct}
                aria-describedby="start-why"
                onClick={() => send({ type: 'start' })}
              >
                {startLabel}
              </button>
              <span id="start-why" className="lb-why">
                {reason}
              </span>
            </div>
          ) : (
            <p className="lb-why lb-why-guest">
              El anfitrión comenzará la partida cuando todos estén listos.
            </p>
          )}
        </div>
      </div>
      {dialog === 'rules' && <RulesModal onClose={closeDialog} />}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </main>
  );
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<'idle' | 'link' | 'code' | 'fail'>('idle');
  const formatted = formatRoomCode(code);
  const link = `${window.location.origin}/sala/${formatted}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function copy(what: 'link' | 'code') {
    const ok = await copyText(what === 'link' ? link : formatted);
    setCopied(ok ? what : 'fail');
    window.setTimeout(() => setCopied('idle'), 2500);
  }
  // El menú de compartir del teléfono; si se cancela no pasa nada, si falla se copia el enlace.
  async function share() {
    try {
      await navigator.share({
        title: 'Love Letter',
        text: `Únete a mi mesa de Love Letter (código ${formatted})`,
        url: link,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) await copy('link');
    }
  }
  return (
    <section className="lb-invite ll-light" aria-label="Invitación a la sala">
      <img
        className="lb-invite-seal"
        src="/assets/seal.webp"
        alt=""
        width={112}
        height={112}
        decoding="async"
      />
      <span className="lb-invite-lbl">Invitación · código de sala</span>
      <div className="lb-invite-code">{formatted}</div>
      <div className="lb-invite-btns">
        {canShare && (
          <button type="button" className="ll-play lb-share" onClick={share}>
            Compartir invitación
          </button>
        )}
        <button
          type="button"
          className={canShare ? 'll-ghost' : 'll-play'}
          onClick={() => copy('link')}
        >
          {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <button type="button" className="ll-ghost" onClick={() => copy('code')}>
          {copied === 'code' ? 'Código copiado' : 'Copiar código'}
        </button>
      </div>
      <span role="status" className="ll-err basis-full empty:hidden">
        {copied === 'fail' ? `Cópialo a mano: ${link}` : ''}
      </span>
    </section>
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
  const isHost = player.id === room.hostId;
  const canRemove = room.you.isHost && !isYou;
  const status = player.bot
    ? 'Bot · siempre listo'
    : !player.connected
      ? 'Desconectado'
      : player.ready
        ? 'Listo'
        : 'Esperando';
  const online = player.bot || player.connected;
  return (
    <li className={`lb-seat${isYou ? ' you' : ''}${online ? '' : ' off'}`}>
      <span
        className={`lb-avatar${player.bot ? ' bot' : ''}`}
        data-initial={player.bot ? '' : player.name.trim().charAt(0).toUpperCase()}
        aria-hidden="true"
      >
        {player.bot && (
          <svg
            aria-hidden="true"
            className="lb-avatar-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v3M7 7h10a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6a3 3 0 013-3zM9 12h.01M15 12h.01M9 16h6" />
          </svg>
        )}
        {isHost && (
          <svg aria-hidden="true" className="lb-crown" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18l1.5-10 5 5L12 5l2.5 8 5-5L21 18zM4 21h16v-2H4z" />
          </svg>
        )}
      </span>
      <span className="lb-seat-txt">
        <span className="lb-name">
          {isYou ? `${player.name} (tú)` : player.name}
          {isHost && <i className="ll-chip on ml-2">Anfitrión</i>}
          {player.bot && <i className="ll-chip ml-2">Bot</i>}
        </span>
        <span className={`lb-status${online ? '' : ' warn'}`}>{status}</span>
      </span>
      <ReadySeal ready={player.bot || player.ready} fixed={player.bot} />
      {canRemove && (
        <button
          type="button"
          className="ll-x lb-x"
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
