import type { CardValue, LegalPlay } from '@loveletter/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChancellorModal } from '../components/ChancellorModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiscardsModal } from '../components/DiscardsModal';
import { DrawLayer } from '../components/DrawLayer';
import { GameMenu } from '../components/GameMenu';
import { GuardModal } from '../components/GuessPicker';
import { GuideModal } from '../components/GuideModal';
import { HandRow } from '../components/HandRow';
import { BookIcon, MoreIcon, ScrollIcon } from '../components/icons';
import { LogModal } from '../components/LogModal';
import { LogoLockup } from '../components/LogoLockup';
import { PlayerPickerModal } from '../components/PlayerPickerModal';
import { PlayNoticeModal } from '../components/PlayNoticeModal';
import { ResultModal } from '../components/ResultModal';
import { RulesModal } from '../components/RulesContent';
import { MineBar } from '../components/SeatCard';
import { TableLayout } from '../components/TableLayout';
import { TOAST_MS, ToastStack } from '../components/ToastStack';
import { TurnBanner } from '../components/TurnBanner';
import { useCanAct, useGame, useRoom } from '../hooks/room';
import { useBotSpeech } from '../hooks/useBotSpeech';
import { useTurnVibration, useWakeLock } from '../hooks/useDevice';
import { useDraws } from '../hooks/useDraws';
import { useTableReady } from '../hooks/useTableReady';
import { effectExtraMs } from '../lib/cardFx';
import { CARD_BY_VALUE, cardName } from '../lib/cards';
import { chronicleLines, type TextContext } from '../lib/chronicle';
import { buildResults, type ChancellorPick, type TableResult } from '../lib/results';
import { pickerPlayers, seatsOf } from '../lib/seats';
import type { NoticeMode } from '../lib/session';
import { useRoomStore } from '../store/room';
import { useUiStore } from '../store/ui';
import { GameOverModal } from './special/GameOver';
import { LeaveDialog } from './special/LeaveDialog';
import { PauseOverlay } from './special/PauseOverlay';
import { RoundOverModal } from './special/RoundOver';

type Flow = 'picker' | 'guard' | 'confirm' | null;

/** Todos los avisos de jugadas se cierran solos; cuanto más hay que leer, más tardan. */
const NOTICE_PUBLIC_MS = 5000;
const NOTICE_AFFECTS_MS = 8000;
const NOTICE_SECRET_MS = 10000;

const noticeBase = (r: TableResult): number =>
  (r.secretFaces && r.secretFaces.length > 0) || r.visibility === 'private'
    ? NOTICE_SECRET_MS
    : r.other?.affectsMe
      ? NOTICE_AFFECTS_MS
      : NOTICE_PUBLIC_MS;

/** Tiempo del aviso: según lo que hay que leer, más un poco si añade una frase larga de "qué hace". */
const noticeMs = (r: TableResult): number => noticeBase(r) + effectExtraMs(r.effect ?? '');

/**
 * Resultados nuevos (tus jugadas y lo que otros te hacen). No repite lo ya visto al conectar.
 * Los que informan o te afectan van a la cola de ventanas (de una en una); los informativos puros
 * (cartas triviales, jugadas ajenas en modo breve) van a avisos que no bloquean.
 */
function useResults(ctx: TextContext, mode: NoticeMode) {
  const game = useGame();
  const seen = useRef<number | null>(null);
  const chancellor = useRef<ChancellorPick | null>(null);
  const [queue, setQueue] = useState<TableResult[]>([]);
  const [toasts, setToasts] = useState<TableResult[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: el contexto cambia en cada render; solo importan los sucesos
  useEffect(() => {
    const lastId = game.events.at(-1)?.id ?? -1;
    if (seen.current === null || lastId < seen.current) {
      seen.current = lastId;
      setQueue([]);
      setToasts([]);
      return;
    }
    const base = seen.current;
    const fresh = game.events.filter((e) => e.id > base);
    if (fresh.length === 0) return;
    seen.current = lastId;
    const results = buildResults(fresh, ctx, chancellor.current);
    const isToast = (r: TableResult) =>
      r.style === 'toast' || (r.other !== undefined && mode === 'brief' && !r.other.affectsMe);
    const modals = results.filter((r) => !isToast(r));
    const light = results.filter(isToast);
    const quick = modals.filter((r) => !r.deferMs);
    if (quick.length) setQueue((q) => [...q, ...quick]);
    for (const r of modals.filter((m) => m.deferMs)) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => setQueue((q) => [...q, r]), reduced ? 0 : (r.deferMs ?? 0));
    }
    if (light.length) setToasts((t) => [...t, ...light]);
  }, [game.events]);
  return {
    queue,
    toasts,
    dismiss: () => setQueue((q) => q.slice(1)),
    dismissToast: (key: string) => setToasts((t) => t.filter((x) => x.key !== key)),
    rememberChancellor: (pick: ChancellorPick) => {
      chancellor.current = pick;
    },
    /** Lo que devolviste al fondo con el Canciller, en orden (para animar el regreso al mazo). */
    pick: () => chancellor.current?.bottom ?? null,
  };
}

function turnText(game: ReturnType<typeof useGame>, nameOf: (id: string) => string): string {
  if (game.phase === 'game_over') return 'Fin de la partida';
  if (game.phase === 'round_over') return 'Fin de la ronda';
  if (game.phase === 'chancellor' && game.isMyTurn) return 'Resuelve el Canciller';
  if (game.isMyTurn) return 'Es tu turno';
  return game.activeId ? `Esperando a ${nameOf(game.activeId)}` : 'Esperando';
}

/** La partida: mesa, mano, jugadas y ventanas de resultado. */
export function GameScreen() {
  const room = useRoom();
  const game = useGame();
  const act = useRoomStore((s) => s.act);
  const send = useRoomStore((s) => s.send);
  const status = useRoomStore((s) => s.status);
  const canAct = useCanAct();
  const dialog = useUiStore((s) => s.dialog);
  const openDialog = useUiStore((s) => s.openDialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const noticeMode = useUiStore((s) => s.noticeMode);
  const setNoticeMode = useUiStore((s) => s.setNoticeMode);
  const haptics = useUiStore((s) => s.haptics);
  const setHaptics = useUiStore((s) => s.setHaptics);
  const wake = useUiStore((s) => s.wake);
  const setWake = useUiStore((s) => s.setWake);

  const [selected, setSelected] = useState<CardValue | null>(null);
  const [flow, setFlow] = useState<Flow>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState<CardValue | null>(null);
  const [chancellorOpen, setChancellorOpen] = useState(true);
  const [seatInfo, setSeatInfo] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [endHidden, setEndHidden] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readCount, setReadCount] = useState<number | null>(null);

  const ctx = useMemo<TextContext>(
    () => ({
      me: game.you.id,
      name: (id) => game.players.find((p) => p.id === id)?.name ?? '¿?',
    }),
    [game.you.id, game.players],
  );
  const results = useResults(ctx, noticeMode);
  const current = results.queue[0];

  const revealKeys = useMemo(
    () => [...results.queue, ...results.toasts].map((r) => r.key),
    [results.queue, results.toasts],
  );
  const modalOpen =
    Boolean(flow) ||
    Boolean(current) ||
    seatInfo !== null ||
    dialog !== null ||
    logOpen ||
    menuOpen;
  const draws = useDraws(game, modalOpen, () => results.pick());
  const baseSeats = useMemo(() => seatsOf(game, room), [game, room]);
  const seats = useMemo(
    () => ({
      me: baseSeats.me,
      rivals: baseSeats.rivals.map((r) => ({ ...r, hiddenBacks: draws.pending[r.id] ?? 0 })),
    }),
    [baseSeats, draws.pending],
  );
  const speech = useBotSpeech(room.chat, modalOpen, revealKeys);
  const busy =
    results.queue.length > 0 ||
    results.toasts.length > 0 ||
    draws.active ||
    speech.pending ||
    Object.keys(speech.speech).length > 0;
  useTableReady(game, busy);

  // Una vista nueva libera el botón de jugar.
  const eventCount = game.events.length;
  const sending = submittedAt === eventCount;
  const ready = canAct && !sending;

  useWakeLock(wake && game.phase !== 'game_over');
  useTurnVibration(game.isMyTurn && game.phase === 'turn', haptics);
  // Medidas de la mesa que el CSS necesita para colocar los avisos sin tapar lo importante.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const bar = document.querySelector('.ll-actbar');
    const rivals = document.querySelector('.ll-rivals');
    const set = () => {
      if (bar) root.style.setProperty('--actbar-h', `${bar.getBoundingClientRect().height}px`);
      if (rivals)
        root.style.setProperty('--rivals-bottom', `${rivals.getBoundingClientRect().bottom}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    if (bar) ro.observe(bar);
    if (rivals) ro.observe(rivals);
    window.addEventListener('resize', set);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
      root.style.removeProperty('--actbar-h');
      root.style.removeProperty('--rivals-bottom');
    };
  }, []);

  const hand = game.you.hand;
  const plays = game.legalPlays;
  const lockedValues = useMemo(
    () => new Set(plays.filter((p) => p.blockedBy === 'countess').map((p) => p.card)),
    [plays],
  );
  const playableCards = plays.filter((p) => p.playable).map((p) => p.card);
  const myPlayTurn = game.isMyTurn && game.phase === 'turn';
  const sel: CardValue | null =
    selected !== null && hand.includes(selected) ? selected : (playableCards[0] ?? hand[0] ?? null);
  const lp: LegalPlay | undefined = sel === null ? undefined : plays.find((p) => p.card === sel);

  // Nueva ronda o nuevo turno: vuelve a mostrar el resumen y reinicia la jugada en curso.
  const phase = game.phase;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia el turno
  useEffect(() => {
    setFlow(null);
    setTarget(null);
    setGuess(null);
    setEndHidden(false);
    setChancellorOpen(true);
  }, [phase, game.activeId, game.round]);

  function submit(card: CardValue, targetId?: string, guessValue?: CardValue) {
    if (
      act({
        type: 'play_card',
        card,
        ...(targetId ? { targetId } : {}),
        ...(guessValue !== undefined ? { guess: guessValue } : {}),
      })
    ) {
      setSubmittedAt(eventCount);
      setFlow(null);
      setTarget(null);
      setGuess(null);
    }
  }

  function startPlay() {
    if (!lp?.playable || !ready) return;
    if (lp.card === 9) return setFlow('confirm');
    if (lp.needsTarget) {
      setTarget(null);
      setGuess(null);
      return setFlow(lp.card === 1 ? 'guard' : 'picker');
    }
    // Sin objetivo (carta sin elección u objetivos inexistentes): se juega directo; el aviso
    // "sin efecto" sale del suceso `no_effect`.
    submit(lp.card);
  }

  const nameOf = ctx.name;
  const hint = !lp
    ? ''
    : lp.blockedBy === 'countess'
      ? `Con la Condesa en la mano no puedes jugar ${cardName(lp.card)}.`
      : lp.card === 8 && hand.some((c) => c === 5 || c === 7)
        ? 'Con Rey o Príncipe en la mano debes jugar la Condesa.'
        : lp.targetRule !== 'none' && !lp.needsTarget
          ? 'No hay a quién elegir: se descarta sin efecto.'
          : CARD_BY_VALUE[lp.card].text;

  const text = turnText(game, nameOf);
  const picker = lp ? pickerPlayers(game, seats, lp.targets) : [];
  const restCard = lp && hand.length === 2 ? hand[hand.indexOf(lp.card) === 0 ? 1 : 0] : undefined;
  const log = useMemo(() => chronicleLines(game.events, ctx), [game.events, ctx]);
  const toWin = game.tokensToWin;
  // Con el registro abierto todo cuenta como leído.
  useEffect(() => {
    if (logOpen) setReadCount(log.length);
  }, [logOpen, log.length]);

  const initialLog = useRef<number | null>(null);
  if (initialLog.current === null) initialLog.current = log.length;
  const baseline = readCount ?? initialLog.current;
  const unread = logOpen ? 0 : Math.max(0, log.length - baseline);
  const seatShown = seatInfo ? [seats.me, ...seats.rivals].find((s) => s.id === seatInfo) : null;
  const chancellorView = game.phase === 'chancellor' ? game.chancellor : null;
  const showEnd = !current && !endHidden;

  // Only the target of the notice being shown is highlighted, and only while it is open: a mark
  // left over from an earlier play (or round) would read as a status the seat no longer has.
  const pickedId = current?.other?.targetId ?? null;
  const allMarks: Record<string, 'hit' | 'picked'> =
    pickedId && pickedId !== game.you.id ? { [pickedId]: current?.hit ? 'hit' : 'picked' } : {};

  const actions =
    myPlayTurn && lp ? (
      <div className="ll-act">
        <button
          type="button"
          className="ll-play"
          disabled={!lp.playable || !ready}
          aria-describedby="act-hint"
          onClick={startPlay}
        >
          Jugar {cardName(lp.card)}
        </button>
        <span className={`hint${hint === CARD_BY_VALUE[lp.card].text ? ' fx' : ''}`} id="act-hint">
          {hint}
        </span>
      </div>
    ) : game.isMyTurn && chancellorView ? (
      <div className="ll-act">
        <button type="button" className="ll-play" onClick={() => setChancellorOpen(true)}>
          Elegir con el Canciller
        </button>
      </div>
    ) : game.phase === 'round_over' && endHidden ? (
      <div className="ll-act">
        <button type="button" className="ll-play" onClick={() => setEndHidden(false)}>
          Ver el resumen
        </button>
      </div>
    ) : (
      <div className="ll-act wait">
        <span className="hint">
          {game.phase === 'turn' || game.phase === 'chancellor'
            ? `${text}… No puedes jugar hasta tu turno.`
            : text}
        </span>
      </div>
    );

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only-ll">
        {current ? `${current.title}. ${current.body}` : text}
      </div>
      <div className="ll-game">
        <div className="ll-bar">
          <button
            type="button"
            className="ll-bar-logo"
            aria-label="Love Letter: salir al inicio"
            onClick={() => openDialog('leave')}
          >
            <LogoLockup />
          </button>
          <div className="ll-bar-actions" role="toolbar" aria-label="Opciones de la partida">
            <button type="button" className="ll-ghost ll-tool" onClick={() => openDialog('rules')}>
              <BookIcon className="ll-ic" />
              <span>Reglas</span>
            </button>
            <button
              type="button"
              className="ll-ghost ll-tool"
              onClick={() => {
                setReadCount(log.length);
                setLogOpen(true);
              }}
            >
              <ScrollIcon className="ll-ic" />
              <span>Registro</span>
              {unread > 0 && (
                <span className="ll-badge" role="img" aria-label={`${unread} sin leer`}>
                  {unread}
                </span>
              )}
            </button>
            <button
              type="button"
              className="ll-ghost ll-hide-lg ll-desk"
              aria-label="Carta guía"
              onClick={() => openDialog('guide')}
            >
              <span className="ll-hide-sm">Carta guía</span>
              <span className="ll-show-xs">Guía</span>
            </button>
            <button
              type="button"
              className="ll-ghost ll-desk"
              role="switch"
              aria-label={`Avisos de jugadas: ${noticeMode === 'full' ? 'completos' : 'breves'}`}
              aria-checked={noticeMode === 'full'}
              onClick={() => setNoticeMode(noticeMode === 'full' ? 'brief' : 'full')}
            >
              Avisos<span className="ll-hide-sm"> de jugadas</span>:{' '}
              {noticeMode === 'full' ? 'completos' : 'breves'}
            </button>
            <button
              type="button"
              className="ll-ghost ll-more"
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            >
              <MoreIcon className="ll-ic" />
              <span>Más</span>
            </button>
          </div>
          <button
            type="button"
            className="ll-ghost ll-exit ll-desk"
            onClick={() => openDialog('leave')}
          >
            Salir
          </button>
          <ToastStack
            anchored
            items={results.toasts.map((r) => ({
              key: r.key,
              ms: TOAST_MS + effectExtraMs(r.effect ?? ''),
              body: (
                <>
                  {r.body}
                  {r.effect && <small className="ll-toast-fx">Qué hace: {r.effect}</small>}
                </>
              ),
            }))}
            onDismiss={results.dismissToast}
          />
        </div>
        <TableLayout
          rivals={seats.rivals}
          toWin={toWin}
          deckCount={Math.max(0, game.deckSize - draws.deckHold)}
          setAside={{ hidden: game.hasSetAside ? 1 : 0, faceUp: game.faceUp }}
          turn={
            <TurnBanner
              round={game.round}
              text={text}
              toWin={toWin}
              mine={game.isMyTurn}
              extra={status === 'open' ? undefined : '● reconectando…'}
            />
          }
          marks={allMarks}
          speech={speech.speech}
          onOpenSeat={setSeatInfo}
          onOpenGuide={() => openDialog('guide')}
          actions={actions}
          mine={
            <>
              <span className="ll-lbl priv">Tu mano · solo tú la ves</span>
              <div className="ll-handzone">
                <HandRow
                  hand={hand}
                  selected={myPlayTurn ? sel : null}
                  onSelect={myPlayTurn ? setSelected : undefined}
                  disabled={!ready}
                  waiting={!myPlayTurn}
                  lockedValues={lockedValues}
                  hideLast={draws.pending[game.you.id] ?? 0}
                />
                <MineBar seat={seats.me} toWin={toWin} onOpen={() => setSeatInfo(game.you.id)}>
                  {game.isMyTurn && !seats.me.eliminated && <i className="ll-chip on">Tu turno</i>}
                </MineBar>
              </div>
            </>
          }
        />
      </div>

      <DrawLayer flights={draws.flights} onLand={draws.land} />
      {menuOpen && (
        <GameMenu
          noticeMode={noticeMode}
          onNoticeMode={setNoticeMode}
          haptics={haptics}
          onHaptics={setHaptics}
          wake={wake}
          onWake={setWake}
          onGuide={() => {
            setMenuOpen(false);
            openDialog('guide');
          }}
          onLeave={() => {
            setMenuOpen(false);
            openDialog('leave');
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {logOpen && <LogModal entries={log} onClose={() => setLogOpen(false)} />}
      {dialog === 'rules' && <RulesModal onClose={closeDialog} />}

      {/* Jugada de otro jugador: ventana completa o aviso breve según la preferencia. */}
      {current?.other && (
        <PlayNoticeModal
          notice={current}
          actorName={current.other.actorId === game.you.id ? 'Tú' : ctx.name(current.other.actorId)}
          targetName={
            current.other.targetId
              ? current.other.targetId === game.you.id
                ? current.other.actorId === game.you.id
                  ? 'Tú mismo'
                  : 'Ti'
                : ctx.name(current.other.targetId)
              : null
          }
          autoCloseMs={noticeMs(current)}
          onContinue={results.dismiss}
        />
      )}

      {/* Resultado de tu jugada: ventana si importa, aviso si es trivial. */}

      {current?.style === 'modal' && !current.other && (
        <ResultModal
          label={current.label}
          title={current.title}
          body={current.body}
          faces={current.faces}
          visibility={current.visibility}
          hit={current.hit}
          autoCloseMs={noticeMs(current)}
          resetKey={current.key}
          onContinue={results.dismiss}
        />
      )}

      {flow === 'picker' && lp && (
        <PlayerPickerModal
          card={lp.card}
          players={picker}
          toWin={toWin}
          restCard={lp.card === 5 ? restCard : undefined}
          onPick={(id) => submit(lp.card, id)}
          onCancel={() => setFlow(null)}
        />
      )}
      {flow === 'guard' && lp && (
        <GuardModal
          players={picker}
          toWin={toWin}
          targetId={target}
          guess={guess}
          onTarget={setTarget}
          onGuess={setGuess}
          onAccuse={() => target && guess !== null && submit(1, target, guess)}
          onCancel={() => setFlow(null)}
        />
      )}
      {flow === 'confirm' && (
        <ConfirmDialog
          label="Confirmar jugar la Princesa"
          title="¿Jugar la Princesa?"
          confirmLabel="Sí, jugarla y salir"
          onCancel={() => setFlow(null)}
          onConfirm={() => submit(9)}
        >
          Si la descartas, quedas fuera de la ronda.
        </ConfirmDialog>
      )}
      {chancellorView && game.isMyTurn && chancellorOpen && !current && !draws.active && (
        <ChancellorModal
          options={chancellorView.hand}
          onCancel={() => setChancellorOpen(false)}
          onConfirm={({ keep, bottom }) => {
            if (act({ type: 'chancellor_keep', keep, bottomOrder: bottom })) {
              results.rememberChancellor({ keep, bottom });
              setChancellorOpen(false);
            }
          }}
        />
      )}

      {seatShown && (
        <DiscardsModal
          name={seatShown.name}
          discards={seatShown.discards}
          eliminated={seatShown.eliminated}
          protectedNow={seatShown.protected}
          spyPlayed={seatShown.spyPlayed}
          onClose={() => setSeatInfo(null)}
        />
      )}
      {dialog === 'guide' && <GuideModal players={game.players.length} onClose={closeDialog} />}

      {showEnd && game.phase === 'round_over' && (
        <RoundOverModal
          game={game}
          disabled={!canAct}
          onContinue={() => act({ type: 'continue_round' })}
          onHide={() => setEndHidden(true)}
        />
      )}
      {showEnd && game.phase === 'game_over' && (
        <GameOverModal
          game={game}
          room={room}
          disabled={!canAct}
          onNewGame={() => send({ type: 'new_game' })}
          onHide={() => setEndHidden(true)}
        />
      )}
      {game.phase === 'game_over' && endHidden && (
        <div className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-20 flex justify-center gap-2">
          <button type="button" className="ll-play" onClick={() => setEndHidden(false)}>
            Ver el podio
          </button>
        </div>
      )}
      <PauseOverlay />
      <LeaveDialog />
    </>
  );
}
