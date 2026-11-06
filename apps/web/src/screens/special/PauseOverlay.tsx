import { HOST_CAN_END_AFTER_MS } from '@loveletter/protocol';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { listNames } from '../../lib/chronicle';
import { useRoomStore } from '../../store/room';

/** "1:15" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** Pausa por desconexión de otro jugador y aviso de tu propia conexión perdida. */
export function PauseOverlay() {
  const room = useRoomStore((s) => s.room);
  const status = useRoomStore((s) => s.status);
  const send = useRoomStore((s) => s.send);
  const offline = status === 'reconnecting' || (status === 'connecting' && room !== null);
  const pause = room?.pause ?? null;
  const now = useNow(Boolean(pause) && !offline);
  const [minimizedAt, setMinimizedAt] = useState<number | null>(null);

  if (!room) return null;

  if (offline) {
    return (
      <Sheet label="Sin conexión" title="Has perdido la conexión" tone="warn" role="alertdialog">
        <p className="ll-rtxt">
          Reintentando… Cuando vuelvas verás la partida tal como está; no puedes jugar hasta
          entonces.
        </p>
      </Sheet>
    );
  }
  if (!pause) return null;

  const missing = pause.disconnectedIds.filter((id) => id !== room.you.id);
  if (missing.length === 0) return null;
  const names = missing.map((id) => room.players.find((p) => p.id === id)?.name ?? '¿?');
  const plural = missing.length > 1;
  const allLeft = missing.every((id) => room.players.find((p) => p.id === id)?.left);
  const total = Math.max(1, pause.hostCanEndAt - pause.since || HOST_CAN_END_AFTER_MS);
  const elapsed = Math.min(total, Math.max(0, now - pause.since));
  const canEnd = now >= pause.hostCanEndAt;
  const isHost = room.you.isHost;
  const title = `${listNames(names)} ${allLeft ? (plural ? 'abandonaron' : 'abandonó') : plural ? 'perdieron' : 'perdió'} ${allLeft ? 'la partida' : 'la conexión'}`;

  if (minimizedAt === pause.since && isHost) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-30 flex flex-wrap items-center justify-center gap-3 border-b border-gold/40 bg-wine px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))]"
      >
        <span>Partida en pausa · esperando a {listNames(names)}</span>
        <button type="button" className="ll-ghost" onClick={() => setMinimizedAt(null)}>
          Ver opciones
        </button>
      </div>
    );
  }

  return (
    <Sheet label="Partida en pausa" title={title} sub="Partida en pausa" role="alertdialog">
      <p className="ll-rtxt">
        La partida sigue en pausa hasta que {plural ? 'vuelvan' : 'vuelva'}. Su asiento y su mano
        {plural ? ' los esperan' : ' lo esperan'}.
      </p>
      <div
        role="progressbar"
        aria-label="Tiempo de espera"
        aria-valuemin={0}
        aria-valuemax={Math.round(total / 1000)}
        aria-valuenow={Math.round(elapsed / 1000)}
        aria-valuetext={`${formatClock(elapsed)} de ${formatClock(total)}`}
        className="h-2 overflow-hidden rounded-full bg-black/40"
      >
        <div className="h-full bg-gold" style={{ width: `${(elapsed / total) * 100}%` }} />
      </div>
      <p className="ll-lbl" data-testid="pause-clock" style={{ margin: 0 }}>
        En pausa · {formatClock(elapsed)} de {formatClock(total)}
      </p>
      <div aria-live="polite">
        {isHost && canEnd ? (
          <div className="ll-row2">
            <button type="button" className="ll-ghost" onClick={() => setMinimizedAt(pause.since)}>
              Seguir esperando
            </button>
            <button type="button" className="ll-play" onClick={() => send({ type: 'end_game' })}>
              Terminar la partida
            </button>
          </div>
        ) : (
          <p className="ll-lbl" style={{ margin: 0 }}>
            {isHost
              ? `Podrás terminar la partida en ${formatClock(pause.hostCanEndAt - now)}.`
              : 'Si no vuelve, el anfitrión podrá terminar la partida.'}
          </p>
        )}
      </div>
    </Sheet>
  );
}
