import { normalizeRoomCode } from '@loveletter/protocol';
import { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { seatToken } from '../lib/session';
import { type ClosedReason, useRoomStore } from '../store/room';
import { JoinLinkScreen } from './entry/JoinLink';
import { LobbyScreen } from './entry/Lobby';
import { LeaveDialog } from './special/LeaveDialog';

const GameScreen = lazy(() => import('./GameScreen').then((m) => ({ default: m.GameScreen })));

/** /sala/:code — entra (por token o por nombre) y muestra la sala de espera o la partida. */
export default function RoomPage() {
  const rawCode = useParams().code ?? '';
  const code = normalizeRoomCode(rawCode);
  const storeCode = useRoomStore((s) => s.code);
  const room = useRoomStore((s) => s.room);
  const closedReason = useRoomStore((s) => s.closedReason);
  const connect = useRoomStore((s) => s.connect);
  const disconnect = useRoomStore((s) => s.disconnect);
  const notice = useRoomStore((s) => s.notice);
  const dismiss = useRoomStore((s) => s.dismissNotice);
  const navigate = useNavigate();
  const hasSeat = code ? seatToken.get(code) !== null : false;

  // Si este navegador ya tiene asiento, reconecta solo.
  useEffect(() => {
    if (code && hasSeat && storeCode !== code) connect(code);
  }, [code, hasSeat, storeCode, connect]);

  // Salir a propósito vuelve al inicio.
  useEffect(() => {
    if (closedReason === 'left') {
      disconnect();
      navigate('/');
    }
  }, [closedReason, disconnect, navigate]);

  useEffect(() => () => useRoomStore.getState().disconnect(), []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);

  if (closedReason && closedReason !== 'left' && storeCode === code) {
    return <ClosedScreen reason={closedReason} />;
  }
  const inThisRoom = code !== null && storeCode === code;
  if (!code || !inThisRoom || (!room && !hasSeat)) return <JoinLinkScreen code={rawCode} />;
  if (!room) return <Loading />;

  return (
    <>
      {room.status === 'lobby' || !room.game ? (
        <LobbyScreen />
      ) : (
        <Suspense fallback={<Loading />}>
          <GameScreen />
        </Suspense>
      )}
      {room.status === 'lobby' && <LeaveDialog />}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
      >
        {notice && (
          <div className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border border-wax bg-wine px-4 py-3 shadow-lg">
            <span>{notice.message}</span>
            <button type="button" className="ll-ghost" onClick={dismiss}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      Entrando a la sala…
    </div>
  );
}

const CLOSED_COPY: Record<Exclude<ClosedReason, null | 'left'>, { title: string; text: string }> = {
  kicked: { title: 'Te han sacado de la mesa', text: 'El anfitrión te expulsó de la sala.' },
  replaced: {
    title: 'Abriste la partida en otra ventana',
    text: 'Solo puede haber una conexión por jugador. Sigue en la otra ventana, o vuelve a entrar aquí.',
  },
  rejected: { title: 'No se pudo entrar', text: 'La sala ya no existe o tu asiento no es válido.' },
};

function ClosedScreen({ reason }: { reason: Exclude<ClosedReason, null | 'left'> }) {
  const copy = CLOSED_COPY[reason];
  const store = useRoomStore();
  const navigate = useNavigate();
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="grid max-w-md justify-items-center gap-4 text-center">
        <h1 className="m-0 font-display text-3xl tracking-wider">{copy.title}</h1>
        <p className="m-0 text-ivory/85">{copy.text}</p>
        <div className="ll-row2">
          {reason === 'replaced' && store.code && (
            <button
              type="button"
              className="ll-play"
              onClick={() => store.code && store.connect(store.code)}
            >
              Jugar en esta ventana
            </button>
          )}
          <button
            type="button"
            className="ll-ghost"
            onClick={() => {
              store.disconnect();
              navigate('/');
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </main>
  );
}
