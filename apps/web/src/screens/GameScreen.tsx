import type { CardValue, LegalPlay } from '@loveletter/engine';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CardFlyer } from '../components/CardFlyer';
import { ChancellorModal } from '../components/ChancellorModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiscardsModal } from '../components/DiscardsModal';
import { DrawLayer, type Rect } from '../components/DrawLayer';
import { GameMenu } from '../components/GameMenu';
import { GuardModal } from '../components/GuessPicker';
import { GuideModal } from '../components/GuideModal';
import { HandRow } from '../components/HandRow';
import { BookIcon, MoreIcon, ScrollIcon } from '../components/icons';
import { LogModal } from '../components/LogModal';
import { LogoLockup } from '../components/LogoLockup';
import { PlayerPickerModal } from '../components/PlayerPickerModal';
import { type NoticeView, PlayNoticeModal, seatOrigin } from '../components/PlayNoticeModal';
import { ResultModal } from '../components/ResultModal';
import { RulesModal } from '../components/RulesContent';
import { MineBar } from '../components/SeatCard';
import { TableLayout } from '../components/TableLayout';
import { TOAST_MS, ToastStack } from '../components/ToastStack';
import { TurnBanner } from '../components/TurnBanner';
import { useCanAct, useGame, useRoom } from '../hooks/room';
import { useBotSpeech } from '../hooks/useBotSpeech';
import { prefersReducedMotion } from '../hooks/useCountdown';
import { useTurnVibration, useWakeLock } from '../hooks/useDevice';
import { useDraws } from '../hooks/useDraws';
import { useTableReady } from '../hooks/useTableReady';
import { effectExtraMs } from '../lib/cardFx';
import { CARD_BY_VALUE, cardName } from '../lib/cards';
import { chronicleLines, groupEvents, type TextContext } from '../lib/chronicle';
import { buildResults, type ChancellorPick, type TableResult } from '../lib/results';
import { pickerPlayers, seatsOf } from '../lib/seats';
import type { NoticeMode } from '../lib/session';
import { useRoomStore } from '../store/room';
import { useUiStore } from '../store/ui';
import { GameOverModal } from './special/GameOver';
import { LeaveDialog } from './special/LeaveDialog';
import { PauseOverlay } from './special/PauseOverlay';
import { RoundOverModal } from './special/RoundOver';

/** Solo la confirmación de la Princesa es local: elegir objetivo ya es una jugada declarada (`room.pending`). */
type Flow = 'confirm' | null;

const rectOf = (el: Element | null | undefined): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/** Hueco por defecto donde aterriza una carta cuando no hay aviso que la reciba (centro de la pantalla). */
const centerRect = (): Rect => ({
  left: window.innerWidth / 2 - 55,
  top: window.innerHeight / 2 - 77,
  width: 110,
  height: 154,
});

/**
 * Una carta que pasa a los descartes de `playerId`. Hasta que llega, su hueco no se ve. `gate` es el
 * aviso de la jugada: mientras siga abierto la carta se queda en él, y al cerrarse vuela de allí al
 * montón (sin aviso, sale ya de la mano o del asiento).
 */
interface DiscardMove {
  id: string;
  playerId: string;
  card: CardValue;
  gate: string | null;
  /** `play`: la carta jugada (viene del aviso o de la mano). `target`: la que descarta el objetivo del Príncipe. */
  src: 'play' | 'target';
  /** Quien descarta (para la procedencia si no hay aviso). */
  actorId: string;
  /** Doncella (escudo) o Espía (ojo): al llegar la carta al descarte se anima el icono del jugador. */
  fx?: 'prot' | 'spy';
  launched?: boolean;
}

/** Qué icono de estado se anima al caer esta carta en el descarte (el Espía también cuenta si se descarta). */
const fxOf = (card: CardValue): { fx?: 'prot' | 'spy' } =>
  card === 4 ? { fx: 'prot' } : card === 0 ? { fx: 'spy' } : {};

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
  const [moves, setMoves] = useState<DiscardMove[]>([]);
  const movesRef = useRef<DiscardMove[]>([]);
  movesRef.current = moves;
  // Escudo y ojo, por `jugador:tipo`: `wait` hasta que la carta cae en el descarte, `fx` mientras dura la animación.
  const [shields, setShields] = useState<Record<string, 'wait' | 'fx'>>({});
  const shieldTimers = useRef(new Set<string>());
  // Layout: los descartes nuevos se ocultan antes de pintar, para que no parpadeen antes de volar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el contexto cambia en cada render; solo importan los sucesos
  useLayoutEffect(() => {
    const lastId = game.events.at(-1)?.id ?? -1;
    if (seen.current === null || lastId < seen.current) {
      seen.current = lastId;
      setQueue([]);
      setToasts([]);
      setMoves([]);
      setShields({});
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
    const gated = new Set(modals.map((r) => r.key));
    const added: DiscardMove[] = [];
    for (const group of groupEvents(fresh)) {
      if (group.kind !== 'play') continue;
      const key = `ev-${group.play.id}`;
      // El Canciller no tiene aviso propio al jugarse: la carta espera a que termine de elegirse
      // (y a que se cierre el aviso final de los demás) antes de volar al descarte.
      const gate = group.effects.some((e) => e.type === 'chancellor')
        ? `chancellor:${group.play.playerId}`
        : gated.has(key)
          ? key
          : null;
      const actorId = group.play.playerId;
      added.push({
        id: `${key}-p`,
        playerId: actorId,
        card: group.play.card,
        gate,
        src: 'play',
        actorId,
        ...fxOf(group.play.card),
      });
      if (fxOf(group.play.card).fx) {
        setShields((sh) => ({ ...sh, [`${actorId}:${fxOf(group.play.card).fx}`]: 'wait' }));
      }
      const prince = group.effects.find((e) => e.type === 'prince');
      if (prince?.type === 'prince') {
        added.push({
          id: `${key}-t`,
          playerId: prince.targetId,
          card: prince.discarded,
          gate,
          src: 'target',
          actorId,
          ...fxOf(prince.discarded),
        });
        if (fxOf(prince.discarded).fx) {
          setShields((sh) => ({ ...sh, [`${prince.targetId}:spy`]: 'wait' }));
        }
      }
    }
    // Al terminar de elegir el Canciller, su carta pasa a esperar el aviso final (si lo hay); se
    // decide aquí, junto con la cola, para que nunca vuele con el aviso aún por abrirse.
    const unlock = new Map<string, string | null>();
    for (const e of fresh) {
      if (e.type === 'chancellor_done') {
        const key = `ev-${e.id}`;
        unlock.set(`chancellor:${e.playerId}`, gated.has(key) ? key : null);
      }
    }
    const resolve = (m: DiscardMove): DiscardMove =>
      m.gate && unlock.has(m.gate) ? { ...m, gate: unlock.get(m.gate) ?? null } : m;
    if (added.length || unlock.size) setMoves((m) => [...m, ...added].map(resolve));
    const light = results.filter(isToast);
    const quick = modals.filter((r) => !r.deferMs);
    if (quick.length) setQueue((q) => [...q, ...quick]);
    for (const r of modals.filter((m) => m.deferMs)) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => setQueue((q) => [...q, r]), reduced ? 0 : (r.deferMs ?? 0));
    }
    if (light.length) setToasts((t) => [...t, ...light]);
  }, [game.events]);
  // El escudo se anima 1,5 s y entonces queda como icono de estado.
  useEffect(() => {
    for (const [pid, st] of Object.entries(shields)) {
      if (st !== 'fx' || shieldTimers.current.has(pid)) continue;
      shieldTimers.current.add(pid);
      window.setTimeout(() => {
        shieldTimers.current.delete(pid);
        setShields((sh) => {
          const { [pid]: _gone, ...rest } = sh;
          return rest;
        });
      }, 1500);
    }
  }, [shields]);
  return {
    queue,
    toasts,
    moves,
    markLaunched: (ids: string[]) =>
      setMoves((m) => m.map((x) => (ids.includes(x.id) ? { ...x, launched: true } : x))),
    shields,
    landMove: (id: string) => {
      const mv = movesRef.current.find((x) => x.id === id);
      if (mv?.fx) {
        const pid = `${mv.playerId}:${mv.fx}`;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        setShields((sh) => {
          if (sh[pid] !== 'wait') return sh;
          if (reduced) {
            const { [pid]: _gone, ...rest } = sh;
            return rest;
          }
          return { ...sh, [pid]: 'fx' };
        });
      }
      setMoves((m) => m.filter((x) => x.id !== id));
    },
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
  const [guess, setGuess] = useState<CardValue | null>(null);
  // Tu jugada: de dónde salió la carta, si ya voló al centro (declarada) y el vuelo en curso.
  const origin = useRef<Rect | null>(null);
  const flown = useRef(false);
  const lastDeclare = useRef(Number.NEGATIVE_INFINITY);
  const [myFlight, setMyFlight] = useState<{ card: CardValue; from: Rect; to: Rect } | null>(null);
  const [pickerReady, setPickerReady] = useState(false);
  // Aviso de un rival ya mostrado: la ventana se completa en el mismo sitio, sin cerrarse.
  const [liveShown, setLiveShown] = useState<{
    key: string;
    actorId: string;
    card: CardValue;
    targetId: string | null;
  } | null>(null);
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
  const me = game.you.id;
  const pending = room.pending;
  const myPending = pending && pending.playerId === me ? pending : null;
  const declaredCard = myPending ? (myPending.card as CardValue) : null;

  const revealKeys = useMemo(
    () => [...results.queue, ...results.toasts].map((r) => r.key),
    [results.queue, results.toasts],
  );
  const modalOpen =
    Boolean(flow) ||
    Boolean(myPending) ||
    Boolean(current) ||
    seatInfo !== null ||
    dialog !== null ||
    logOpen ||
    menuOpen;
  const draws = useDraws(game, modalOpen, () => results.pick());
  const baseSeats = useMemo(() => seatsOf(game, room), [game, room]);
  const heldDiscards = useMemo(() => {
    const held: Record<string, number> = {};
    for (const m of results.moves) held[m.playerId] = (held[m.playerId] ?? 0) + 1;
    return held;
  }, [results.moves]);
  const seats = useMemo(
    () => ({
      me: {
        ...baseSeats.me,
        hiddenDiscards: heldDiscards[baseSeats.me.id] ?? 0,
        shield: results.shields[`${baseSeats.me.id}:prot`],
        eye: results.shields[`${baseSeats.me.id}:spy`],
      },
      rivals: baseSeats.rivals.map((r) => ({
        ...r,
        hiddenDiscards: heldDiscards[r.id] ?? 0,
        shield: results.shields[`${r.id}:prot`],
        eye: results.shields[`${r.id}:spy`],
        // La carta declarada ya salió de su mano: su hueco queda vacío mientras decide.
        hiddenBacks: (draws.pending[r.id] ?? 0) + (pending?.playerId === r.id ? 1 : 0),
      })),
    }),
    [baseSeats, draws.pending, pending?.playerId, heldDiscards, results.shields],
  );
  // Descartes: la carta vuela al montón de quien la descarta cuando su aviso se cierra.
  const noticeRect = useRef<Rect | null>(null);
  const [discardFlights, setDiscardFlights] = useState<
    { id: string; card: CardValue; from: Rect; to: Rect; fromBack: boolean; delay: number }[]
  >([]);
  const openKeys = useMemo(
    () => new Set([...results.queue, ...results.toasts].map((r) => r.key)),
    [results.queue, results.toasts],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambian las jugadas por descartar o los avisos abiertos
  useEffect(() => {
    const ready = results.moves.filter((m) => {
      if (m.launched) return false;
      if (!m.gate) return true;
      if (m.gate.startsWith('chancellor:')) return false;
      return !openKeys.has(m.gate);
    });
    if (ready.length === 0) return;
    results.markLaunched(ready.map((m) => m.id));
    const reduced = prefersReducedMotion();
    const flights: typeof discardFlights = [];
    for (const [n, m] of ready.entries()) {
      const mineSeat = m.playerId === me;
      const pile = Array.from(
        document.querySelectorAll(
          mineSeat ? '.ll-mine .ll-fan > *' : `[data-seat-id="${m.playerId}"] .ll-fan > *`,
        ),
      );
      const all = results.moves.filter((x) => x.playerId === m.playerId);
      const to = rectOf(pile[pile.length - all.length + all.findIndex((x) => x.id === m.id)]);
      let from: Rect | null = null;
      let fromBack = false;
      if (m.gate?.startsWith('chancellor:') && m.actorId === me) {
        // Tu Canciller no tiene aviso: la carta salió al centro y de allí vuelve al descarte.
        from = centerRect();
      } else if (m.src === 'play' && m.gate && noticeRect.current) {
        from = noticeRect.current;
      } else if (m.src === 'play' && m.actorId === me) {
        from = origin.current;
      } else if (m.src === 'target' && m.playerId === me) {
        from = rectOf(document.querySelector('.ll-hand .ll-card'));
      } else {
        from = seatOrigin(m.src === 'play' ? m.actorId : m.playerId);
        fromBack = true;
      }
      if (reduced || !from || !to) results.landMove(m.id);
      else flights.push({ id: m.id, card: m.card, from, to, fromBack, delay: n * 0.25 });
    }
    noticeRect.current = null;
    if (flights.length === 0) return;
    setDiscardFlights((f) => [...f, ...flights]);
    // Red de seguridad: si una animación no avisa, la carta se muestra igualmente.
    for (const f of flights) {
      window.setTimeout(() => results.landMove(f.id), (f.delay + 0.65 + 0.6) * 1000);
    }
  }, [results.moves, openKeys]);

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
  // Tu carta del turno todavía viaja del mazo a tu mano: hasta que aterriza no se puede jugar.
  const takingCard = (draws.pending[game.you.id] ?? 0) > 0;
  const ready = canAct && !sending && !takingCard;

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

  // La carta declarada sale de tu mano (la ven todos en el aviso); queda la otra.
  const fullHand = game.you.hand;
  const hand = useMemo(() => {
    if (declaredCard === null) return fullHand;
    const i = fullHand.indexOf(declaredCard);
    return i < 0 ? fullHand : fullHand.filter((_, k) => k !== i);
  }, [fullHand, declaredCard]);
  const plays = game.legalPlays;
  const lockedValues = useMemo(
    () => new Set(plays.filter((p) => p.blockedBy === 'countess').map((p) => p.card)),
    [plays],
  );
  const playableCards = plays.filter((p) => p.playable).map((p) => p.card);
  const myPlayTurn = game.isMyTurn && game.phase === 'turn';
  const sel: CardValue | null =
    selected !== null && hand.includes(selected) ? selected : (playableCards[0] ?? hand[0] ?? null);
  const lp: LegalPlay | undefined =
    declaredCard !== null
      ? plays.find((p) => p.card === declaredCard)
      : sel === null
        ? undefined
        : plays.find((p) => p.card === sel);

  // Nueva ronda o nuevo turno: vuelve a mostrar el resumen y reinicia la jugada en curso.
  const phase = game.phase;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia el turno
  useEffect(() => {
    setFlow(null);
    setGuess(null);
    setEndHidden(false);
    setChancellorOpen(true);
    flown.current = false;
  }, [phase, game.activeId, game.round]);

  // Tras declarar, la carta vuela al centro y entonces se abre la elección de objetivo. Si
  // recargas o reconectas con la jugada ya declarada, se retoma al instante.
  const hasPending = myPending !== null;
  useEffect(() => {
    if (!hasPending) return setPickerReady(false);
    const wait = flown.current && origin.current && !prefersReducedMotion() ? 600 : 0;
    const timer = window.setTimeout(() => setPickerReady(true), wait);
    return () => window.clearTimeout(timer);
  }, [hasPending]);

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
      setGuess(null);
    }
  }

  /** La carta sale de tu mano: recuerda dónde estaba y, si no habrá aviso que la reciba, vuela al centro. */
  function leaveHand(card: CardValue, toCenter: boolean) {
    const el = Array.from(document.querySelectorAll('.ll-hand .ll-card')).find((c) =>
      c.getAttribute('aria-label')?.startsWith(`${card},`),
    );
    origin.current = rectOf(el ?? document.querySelector('.ll-hand .ll-card'));
    flown.current = toCenter;
    if (toCenter && origin.current && !prefersReducedMotion()) {
      setMyFlight({ card, from: origin.current, to: centerRect() });
    }
  }

  function startPlay() {
    if (!lp?.playable || !ready || myPending) return;
    if (lp.card === 9) return setFlow('confirm');
    if (lp.needsTarget) {
      // Declarar: desde aquí todos ven la carta y ya no hay vuelta atrás.
      if (performance.now() - lastDeclare.current < 1500) return;
      setGuess(null);
      leaveHand(lp.card, true);
      if (send({ type: 'declare_play', card: lp.card })) lastDeclare.current = performance.now();
      return;
    }
    // Sin objetivo (carta sin elección u objetivos inexistentes): se juega directo; el aviso
    // "sin efecto" sale del suceso `no_effect`.
    leaveHand(lp.card, lp.card === 6);
    submit(lp.card);
  }

  const nameOf = ctx.name;
  const hint = !lp
    ? ''
    : myPending
      ? 'Elige el objetivo: la carta ya está jugada y no hay vuelta atrás.'
      : takingCard
        ? 'Tomando carta…'
        : lp.blockedBy === 'countess'
          ? `Con la Condesa en la mano no puedes jugar ${cardName(lp.card)}.`
          : lp.card === 8 && hand.some((c) => c === 5 || c === 7)
            ? 'Con Rey o Príncipe en la mano debes jugar la Condesa.'
            : lp.targetRule !== 'none' && !lp.needsTarget
              ? 'No hay a quién elegir: se descarta sin efecto.'
              : CARD_BY_VALUE[lp.card].text;

  const text = turnText(game, nameOf);
  const picker = lp ? pickerPlayers(game, seats, lp.targets) : [];
  // El Príncipe sobre ti: la carta que descartarías es la otra de tu mano.
  const restCard = hand.length === 1 ? hand[0] : undefined;
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
  // El resultado de la ronda espera a que los bots terminen de comentar el final: primero lo que
  // dicen, luego el resumen; los comentarios de la ronda nueva llegan después de continuar.
  const speechIdle = !speech.pending && Object.keys(speech.speech).length === 0;
  const [endGate, setEndGate] = useState(false);
  useEffect(() => {
    if (phase !== 'round_over') return setEndGate(false);
    if (endGate || !speechIdle) return;
    const timer = window.setTimeout(() => setEndGate(true), 700);
    return () => window.clearTimeout(timer);
  }, [phase, speechIdle, endGate]);
  // Salvavidas: si los globos no terminan (pestaña dormida), el resumen sale igual.
  useEffect(() => {
    if (phase !== 'round_over') return;
    const timer = window.setTimeout(() => setEndGate(true), 25_000);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const showEnd = !current && !endHidden && (phase !== 'round_over' || endGate);

  // Jugada de otro en curso (declarada o Canciller en espera): su aviso se abre ya, con la carta
  // sobre la mesa, y se completa en el mismo sitio. En modo breve solo si te toca a ti.
  const liveCandidate =
    pending && pending.playerId !== me
      ? { actorId: pending.playerId, card: pending.card as CardValue, targetId: pending.targetId }
      : phase === 'chancellor' && game.activeId && game.activeId !== me
        ? { actorId: game.activeId, card: 6 as CardValue, targetId: null }
        : null;
  const liveVisible =
    !current && liveCandidate !== null && (noticeMode === 'full' || liveCandidate.targetId === me);
  const liveKey = liveCandidate
    ? `live-${game.round}-${liveCandidate.actorId}-${liveCandidate.card}-${eventCount}`
    : null;
  const continued =
    current?.other &&
    liveShown &&
    liveShown.actorId === current.other.actorId &&
    liveShown.card === current.other.card
      ? liveShown
      : null;
  let noticeView: NoticeView | null = null;
  if (current?.other) {
    noticeView = {
      key: continued?.key ?? current.key,
      actorId: current.other.actorId,
      card: current.other.card,
      targetId: current.other.targetId,
      result: current,
      fly: !continued && !(flown.current && current.other.actorId === me),
      staged: !continued && !(flown.current && current.other.actorId === me),
    };
  } else if (liveVisible && liveCandidate && liveKey) {
    noticeView = { key: liveKey, ...liveCandidate, result: null, fly: true, staged: false };
  } else if (liveShown && !current) {
    // El resultado está a punto de llegar: la ventana no parpadea entre el aviso y el resultado.
    noticeView = { ...liveShown, result: null, fly: false, staged: false };
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia lo que se está mostrando
  useEffect(() => {
    if (liveVisible && liveCandidate && liveKey) {
      setLiveShown((prev) =>
        prev &&
        prev.key === liveKey &&
        prev.targetId === liveCandidate.targetId &&
        prev.card === liveCandidate.card
          ? prev
          : { key: liveKey, ...liveCandidate },
      );
      return;
    }
    if (current || !liveShown) return;
    // Nada más que esperar: si el resultado no llega pronto (aviso breve), se retira.
    const timer = window.setTimeout(() => setLiveShown(null), 1500);
    return () => window.clearTimeout(timer);
  }, [liveVisible, liveKey, liveCandidate?.targetId, current, liveShown]);

  // Only the target of the notice being shown is highlighted, and only while it is open: a mark
  // left over from an earlier play (or round) would read as a status the seat no longer has.
  const pickedId = noticeView?.targetId ?? null;
  const allMarks: Record<string, 'hit' | 'picked'> =
    pickedId && pickedId !== game.you.id
      ? { [pickedId]: current?.hit && noticeView?.result ? 'hit' : 'picked' }
      : {};

  const actions =
    myPlayTurn && lp ? (
      <div className="ll-act">
        <button
          type="button"
          className="ll-play"
          disabled={!lp.playable || !ready || Boolean(myPending)}
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
            className="ll-danger ll-exit ll-desk"
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
          deckNudge={draws.deckNudge}
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
                <MineBar seat={seats.me} toWin={toWin} onOpen={() => setSeatInfo(game.you.id)} />
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

      {/* Jugada de cualquiera: la carta vuela al aviso, que se completa según se decide. */}
      {noticeView && (
        <PlayNoticeModal
          key={noticeView.key}
          view={noticeView}
          actorName={noticeView.actorId === me ? 'Tú' : ctx.name(noticeView.actorId)}
          targetName={
            noticeView.targetId
              ? noticeView.targetId === me
                ? noticeView.actorId === me
                  ? 'Tú mismo'
                  : 'Ti'
                : ctx.name(noticeView.targetId)
              : null
          }
          mine={noticeView.actorId === me}
          origin={origin.current}
          autoCloseMs={current ? noticeMs(current) : NOTICE_PUBLIC_MS}
          onContinue={() => {
            noticeRect.current = rectOf(
              document.querySelector('.ll-sheet .ll-notice-row .ll-card'),
            );
            setLiveShown(null);
            flown.current = false;
            results.dismiss();
          }}
        />
      )}
      {discardFlights.map((f) => (
        <CardFlyer
          key={f.id}
          card={f.card}
          from={f.from}
          to={f.to}
          fromBack={f.fromBack}
          delay={f.delay}
          onLand={() => {
            setDiscardFlights((list) => list.filter((x) => x.id !== f.id));
            results.landMove(f.id);
          }}
        />
      ))}
      {myFlight && (
        <CardFlyer
          card={myFlight.card}
          from={myFlight.from}
          to={myFlight.to}
          fromBack={false}
          fade
          onLand={() => setMyFlight(null)}
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

      {pickerReady && myPending && lp && myPending.card !== 1 && (
        <PlayerPickerModal
          card={lp.card}
          players={picker}
          toWin={toWin}
          restCard={lp.card === 5 ? restCard : undefined}
          onPick={(id) => submit(lp.card, id)}
        />
      )}
      {pickerReady && myPending && lp && myPending.card === 1 && (
        <GuardModal
          players={picker}
          toWin={toWin}
          targetId={myPending.targetId}
          guess={guess}
          onTarget={(id) => {
            if (!myPending.targetId) send({ type: 'declare_target', targetId: id });
          }}
          onGuess={setGuess}
          onAccuse={() =>
            myPending.targetId && guess !== null && submit(1, myPending.targetId, guess)
          }
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
          tokens={seatShown.tokens}
          toWin={toWin}
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
