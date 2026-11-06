import {
  type Action,
  applyAction,
  type BotNotes,
  botEvents,
  botFarewell,
  botRemark,
  chooseBotAction,
  createBotNotes,
  createGame,
  emptyBotNotes,
  eventKey,
  type GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PlayerId,
  type Random,
  viewFor,
} from '@loveletter/engine';
import {
  type ChatLine,
  type ClientMessage,
  cleanName,
  DEFAULT_ROOM_CONFIG,
  HOST_CAN_END_AFTER_MS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  type RoomConfig,
  type RoomErrorCode,
  type RoomInfo,
  type RoomStatus,
  type RoomView,
  tableMoment,
  toEngineAction,
} from '@loveletter/protocol';

export interface Seat {
  id: string;
  name: string;
  /** SHA-256 of the seat token; the token itself is only ever held by its player. */
  tokenHash: string;
  ready: boolean;
  /** Left a game in progress. The seat is kept so the game can be ended cleanly. */
  left: boolean;
  /** A computer player: always ready, always connected, moved by the room itself. */
  bot?: boolean;
}

/** Everything the room persists. */
export interface RoomData {
  code: string;
  createdAt: number;
  lastActivity: number;
  hostId: string | null;
  seats: Seat[];
  nextSeatNumber: number;
  config: RoomConfig;
  game: GameState | null;
  pausedSince: number | null;
  /** What each bot remembers during the current game. */
  botNotes?: Record<string, BotNotes>;
  /** When the next bot move is due (set by the Durable Object), and the moment it was planned for. */
  botDueAt?: number | null;
  botSeenMoment?: string;
  /** A bot move held until every connected human has seen the table settle (see `planBotMove`). */
  hold?: { moment: string; seats: string[] } | null;
  /** Recent bot remarks, oldest first. */
  chat?: ChatLine[];
  nextChatId?: number;
}

/** Bot names: Spanish first names, never clashing with a player's. */
const BOT_NAMES = [
  'Lucía',
  'Mateo',
  'Sofía',
  'Diego',
  'Valentina',
  'Andrés',
  'Camila',
  'Tomás',
  'Elena',
  'Joaquín',
  'Martina',
  'Santiago',
  'Isabella',
  'Sebastián',
  'Paula',
  'Nicolás',
  'Daniela',
  'Emilio',
  'Marta',
  'Álvaro',
  'Julia',
  'Gonzalo',
  'Carmen',
  'Rodrigo',
  'Natalia',
  'Ignacio',
  'Alba',
  'Bruno',
  'Clara',
  'Pablo',
  'Irene',
  'Héctor',
  'Rocío',
  'Samuel',
  'Lorena',
  'Adrián',
  'Pilar',
  'Marcos',
  'Regina',
  'Esteban',
  'Mariana',
  'Felipe',
  'Renata',
  'Gael',
  'Olivia',
  'Ramiro',
  'Abril',
  'Julián',
  'Cecilia',
  'Lautaro',
];
const MAX_CHAT_LINES = 60;
/** At most this many bots speak about the same event, and this many say goodbye. */
const REMARKS_PER_EVENT = 2;
const FAREWELLS = 3;

/** Per-event inputs that do not belong in the persisted data. */
export interface RoomContext {
  now: number;
  /** Seats with at least one open connection. */
  connected: ReadonlySet<string>;
  random: Random;
}

export type RoomResult =
  | { ok: true; seat?: Seat; kicked?: string; left?: string }
  | { ok: false; code: RoomErrorCode; message: string };

const okResult: RoomResult = { ok: true };

function error(code: RoomErrorCode, message: string): RoomResult {
  return { ok: false, code, message };
}

export function createRoom(code: string, now: number): RoomData {
  return {
    code,
    createdAt: now,
    lastActivity: now,
    hostId: null,
    seats: [],
    nextSeatNumber: 1,
    config: { ...DEFAULT_ROOM_CONFIG },
    game: null,
    pausedSince: null,
  };
}

/** lobby, playing, finished; `roomStatus` adds `paused` on top of playing. */
function stage(data: RoomData): 'lobby' | 'playing' | 'finished' {
  if (!data.game) return 'lobby';
  return data.game.phase === 'game_over' ? 'finished' : 'playing';
}

export function roomStatus(data: RoomData): RoomStatus {
  const s = stage(data);
  return s === 'playing' && data.pausedSince !== null ? 'paused' : s;
}

export function findSeatByTokenHash(data: RoomData, tokenHash: string): Seat | undefined {
  return data.seats.find((s) => s.tokenHash !== '' && s.tokenHash === tokenHash);
}

/** Bots are always at the table; people only while connected. */
function isOnline(data: RoomData, ctx: RoomContext, seatId: string): boolean {
  return ctx.connected.has(seatId) || data.seats.some((s) => s.id === seatId && s.bot);
}

function isReady(seat: Seat): boolean {
  return seat.ready || Boolean(seat.bot);
}

function activeSeats(data: RoomData): Seat[] {
  return data.seats.filter((s) => !s.left);
}

function humanSeats(data: RoomData): Seat[] {
  return data.seats.filter((s) => !s.bot && !s.left);
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;
}

/** Keeps `config.bots` equal to the bots actually seated. */
function syncConfig(data: RoomData): void {
  data.config = { ...data.config, bots: data.seats.filter((s) => s.bot).length };
}

export function addSeat(
  data: RoomData,
  rawName: string,
  tokenHash: string,
  ctx: RoomContext,
): RoomResult {
  if (stage(data) !== 'lobby') {
    return error('game_in_progress', 'La partida ya comenzó');
  }
  const name = cleanName(rawName);
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return error(
      'bad_message',
      `El nombre debe tener entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres`,
    );
  }
  if (data.seats.some((s) => sameName(s.name, name))) {
    return error('name_taken', `Ya hay alguien llamado ${name} en la mesa`);
  }
  if (activeSeats(data).length >= MAX_PLAYERS) {
    // A person takes the place of a computer player.
    const lastBot = [...data.seats].reverse().find((s) => s.bot);
    if (!lastBot) return error('room_full', `La mesa ya tiene ${MAX_PLAYERS} jugadores`);
    data.seats = data.seats.filter((s) => s.id !== lastBot.id);
    syncConfig(data);
  }

  const seat: Seat = { id: `s${data.nextSeatNumber}`, name, tokenHash, ready: false, left: false };
  data.nextSeatNumber += 1;
  data.seats.push(seat);
  data.hostId ??= seat.id;
  touch(data, ctx);
  return { ok: true, seat };
}

/** A seat's connection opened (new join or reconnect). */
export function connectSeat(data: RoomData, seatId: string, ctx: RoomContext): void {
  const seat = data.seats.find((s) => s.id === seatId);
  if (!seat) return;
  seat.left = false;
  if (!data.hostId || !data.seats.some((s) => s.id === data.hostId)) data.hostId = seatId;
  updatePause(data, ctx);
  touch(data, ctx);
}

/** A seat lost its last connection. `ctx.connected` must no longer include it. */
export function disconnectSeat(data: RoomData, seatId: string, ctx: RoomContext): void {
  if (data.hostId === seatId) transferHost(data, ctx);
  updatePause(data, ctx);
  touch(data, ctx);
}

export function handleMessage(
  data: RoomData,
  seatId: string,
  message: ClientMessage,
  ctx: RoomContext,
): RoomResult {
  const seat = data.seats.find((s) => s.id === seatId);
  if (!seat || seat.bot) return error('invalid_seat', 'No tienes asiento en esta mesa');
  const where = stage(data);
  const isHost = data.hostId === seatId;
  touch(data, ctx);

  switch (message.type) {
    case 'join':
      return error('already_joined', 'Ya estás en la mesa');

    case 'table_ready':
      if (data.hold && data.game && data.hold.moment === message.moment) {
        if (!data.hold.seats.includes(seatId)) data.hold.seats.push(seatId);
      }
      return okResult;

    case 'set_ready':
      if (where !== 'lobby') return error('not_in_lobby', 'La partida ya comenzó');
      seat.ready = message.ready;
      return okResult;

    case 'configure': {
      if (!isHost) return error('not_host', 'Solo el anfitrión cambia la configuración');
      if (where !== 'lobby') return error('not_in_lobby', 'La partida ya comenzó');
      if (message.config.bots !== undefined) {
        const space = MAX_PLAYERS - humanSeats(data).length;
        if (message.config.bots > space) {
          return error(
            'invalid_config',
            `Solo hay lugar para ${space} jugadores de la computadora`,
          );
        }
        setBots(data, message.config.bots, ctx);
      }
      return okResult;
    }

    case 'kick': {
      if (!isHost) return error('not_host', 'Solo el anfitrión puede expulsar');
      if (where !== 'lobby')
        return error('not_in_lobby', 'No se puede expulsar durante la partida');
      const target = data.seats.find((s) => s.id === message.playerId);
      if (!target || target.bot || target.id === seatId) {
        return error('invalid_seat', 'No puedes expulsar a ese jugador');
      }
      removeSeat(data, message.playerId, ctx);
      return { ok: true, kicked: message.playerId };
    }

    case 'start': {
      if (!isHost) return error('not_host', 'Solo el anfitrión empieza la partida');
      if (where !== 'lobby') return error('not_in_lobby', 'La partida ya comenzó');
      if (data.seats.length < MIN_PLAYERS) {
        return error('not_enough_players', `Hacen falta al menos ${MIN_PLAYERS} jugadores`);
      }
      if (!data.seats.every((s) => isReady(s) && isOnline(data, ctx, s.id))) {
        return error('not_everyone_ready', 'Todos deben estar conectados y listos');
      }
      const created = createGame(
        { players: data.seats.map((s) => ({ id: s.id, name: s.name, bot: Boolean(s.bot) })) },
        ctx.random,
      );
      if (!created.ok) return error(created.error.code, created.error.message);
      data.game = created.value;
      data.botNotes = Object.fromEntries(
        data.seats.filter((s) => s.bot).map((s) => [s.id, createBotNotes(ctx.random)]),
      );
      data.chat = [];
      data.botSeenMoment = undefined;
      data.hold = null;
      data.botDueAt = null;
      for (const s of data.seats) s.ready = false;
      updatePause(data, ctx);
      return okResult;
    }

    case 'action': {
      if (where !== 'playing' || !data.game) return error('not_playing', 'No hay partida en curso');
      if (data.pausedSince !== null) {
        return error('game_paused', 'La partida está en pausa hasta que vuelvan todos');
      }
      const before = data.game;
      const result = applyAction(before, toEngineAction(seatId, message.action), ctx.random);
      if (!result.ok) return error(result.error.code, result.error.message);
      data.game = result.value;
      botsReact(data, before, ctx);
      updatePause(data, ctx);
      return okResult;
    }

    case 'leave':
      if (where === 'lobby') {
        removeSeat(data, seatId, ctx);
      } else {
        seat.left = true;
        if (isHost) transferHost(data, ctx);
        updatePause(data, ctx);
      }
      return { ok: true, left: seatId };

    case 'end_game': {
      if (!isHost) return error('not_host', 'Solo el anfitrión puede terminar la partida');
      if (where !== 'playing') return error('not_playing', 'No hay partida en curso');
      if (data.pausedSince === null || ctx.now - data.pausedSince < HOST_CAN_END_AFTER_MS) {
        return error(
          'not_paused_long_enough',
          'Solo se puede terminar tras un rato esperando a un jugador desconectado',
        );
      }
      backToLobby(data, ctx);
      return okResult;
    }

    case 'new_game':
      if (!isHost) return error('not_host', 'Solo el anfitrión puede empezar otra partida');
      if (where !== 'finished') return error('not_playing', 'La partida no ha terminado');
      backToLobby(data, ctx);
      return okResult;
  }
}

export function roomView(data: RoomData, seatId: string, ctx: RoomContext): RoomView {
  const status = roomStatus(data);
  const inGame = data.game?.players.some((p) => p.id === seatId) ?? false;
  return {
    code: data.code,
    status,
    you: { id: seatId, isHost: data.hostId === seatId },
    hostId: data.hostId,
    players: data.seats.map((s) => ({
      id: s.id,
      name: s.name,
      ready: isReady(s),
      connected: isOnline(data, ctx, s.id),
      left: s.left,
      bot: Boolean(s.bot),
      host: data.hostId === s.id,
    })),
    config: { ...data.config },
    limits: { minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS },
    canStart:
      stage(data) === 'lobby' &&
      data.seats.length >= MIN_PLAYERS &&
      data.seats.every((s) => isReady(s) && isOnline(data, ctx, s.id)),
    game: data.game && inGame ? viewFor(data.game, seatId) : null,
    chat: [...(data.chat ?? [])],
    pause:
      status === 'paused' && data.pausedSince !== null
        ? {
            disconnectedIds: disconnectedPlayers(data, ctx),
            since: data.pausedSince,
            hostCanEndAt: data.pausedSince + HOST_CAN_END_AFTER_MS,
          }
        : null,
  };
}

export function roomInfo(data: RoomData): RoomInfo {
  const seats = activeSeats(data);
  const bots = seats.filter((s) => s.bot).length;
  return {
    code: data.code,
    status: roomStatus(data),
    playerCount: seats.length,
    // A person can always take the place of a computer player in the lobby.
    joinable: stage(data) === 'lobby' && (seats.length < MAX_PLAYERS || bots > 0),
    playerNames: seats.map((s) => s.name),
    hostName: data.seats.find((s) => s.id === data.hostId)?.name ?? null,
  };
}

// ---------------------------------------------------------------------------

function disconnectedPlayers(data: RoomData, ctx: RoomContext): string[] {
  const ids = data.game?.players.map((p) => p.id) ?? [];
  return ids.filter((id) => {
    const seat = data.seats.find((s) => s.id === id);
    return !seat || seat.left || !isOnline(data, ctx, id);
  });
}

function updatePause(data: RoomData, ctx: RoomContext): void {
  if (stage(data) !== 'playing') {
    data.pausedSince = null;
    return;
  }
  if (disconnectedPlayers(data, ctx).length === 0) data.pausedSince = null;
  else data.pausedSince ??= ctx.now;
}

/** Hands the host role to the next connected person clockwise, if any. */
function transferHost(data: RoomData, ctx: RoomContext): void {
  const from = Math.max(
    0,
    data.seats.findIndex((s) => s.id === data.hostId),
  );
  for (let i = 1; i <= data.seats.length; i++) {
    const seat = data.seats[(from + i) % data.seats.length];
    if (seat && seat.id !== data.hostId && !seat.left && !seat.bot && ctx.connected.has(seat.id)) {
      data.hostId = seat.id;
      return;
    }
  }
}

function removeSeat(data: RoomData, seatId: string, ctx: RoomContext): void {
  if (data.hostId === seatId) transferHost(data, ctx);
  data.seats = data.seats.filter((s) => s.id !== seatId);
  if (data.hostId === seatId) data.hostId = data.seats.find((s) => !s.bot)?.id ?? null;
  syncConfig(data);
}

function backToLobby(data: RoomData, ctx: RoomContext): void {
  data.game = null;
  data.pausedSince = null;
  data.botNotes = {};
  data.chat = [];
  data.botDueAt = null;
  data.botSeenMoment = undefined;
  data.hold = null;
  const leaving = data.seats.filter((s) => s.left).map((s) => s.id);
  for (const id of leaving) removeSeat(data, id, ctx);
  for (const s of data.seats) s.ready = false;
}

function touch(data: RoomData, ctx: RoomContext): void {
  data.lastActivity = ctx.now;
}

// ---------------------------------------------------------------------------
// Bots

/** Makes the number of computer players at the table exactly `count`. */
function setBots(data: RoomData, count: number, ctx: RoomContext): void {
  let bots = data.seats.filter((s) => s.bot);
  while (bots.length > count) {
    const last = bots.pop() as Seat;
    data.seats = data.seats.filter((s) => s.id !== last.id);
  }
  while (bots.length < count) {
    const taken = (name: string) => data.seats.some((s) => sameName(s.name, name));
    const free = BOT_NAMES.filter((n) => !taken(n));
    const name = free[Math.floor(ctx.random() * free.length)] ?? `Bot ${data.nextSeatNumber}`;
    const seat: Seat = {
      id: `s${data.nextSeatNumber}`,
      name,
      tokenHash: '',
      ready: true,
      left: false,
      bot: true,
    };
    data.nextSeatNumber += 1;
    data.seats.push(seat);
    bots = [...bots, seat];
  }
  syncConfig(data);
}

interface BotMove {
  botId: PlayerId;
  action: Action;
  notes: BotNotes;
}

/** The move the first bot with something to do would make, or null. */
function nextBotMove(data: RoomData, random: Random): BotMove | null {
  const game = data.game;
  if (!game || stage(data) !== 'playing' || data.pausedSince !== null) return null;
  // The engine pre-confirms bots at the end of a round; with nobody else to confirm, one of
  // them has to press "continue" or the table would wait forever.
  const first = game.players[0];
  if (game.phase === 'round_over' && first && game.players.every((p) => p.bot)) {
    return {
      botId: first.id,
      action: { type: 'continue_round', playerId: first.id },
      notes: notesOf(data, first.id),
    };
  }
  for (const seat of data.seats) {
    if (!seat.bot || !game.players.some((p) => p.id === seat.id)) continue;
    const choice = chooseBotAction(viewFor(game, seat.id), notesOf(data, seat.id), random);
    if (choice) return { botId: seat.id, action: choice.action, notes: choice.notes };
  }
  return null;
}

/** The bot that has to move now, if any (the game is on and not paused). */
export function pendingBot(data: RoomData): PlayerId | null {
  // A throwaway random: this only asks whether the bot has a move.
  return nextBotMove(data, () => 0.5)?.botId ?? null;
}

/** Plays one move for a bot whose turn it is. Returns false when no bot had to move. */
export function playBot(data: RoomData, ctx: RoomContext): boolean {
  const game = data.game;
  const move = nextBotMove(data, ctx.random);
  if (!move || !game) return false;
  const result = applyAction(game, move.action, ctx.random);
  if (!result.ok) return false;
  data.botNotes = { ...data.botNotes, [move.botId]: move.notes };
  data.game = result.value;
  botsReact(data, game, ctx);
  updatePause(data, ctx);
  touch(data, ctx);
  return true;
}

/**
 * The moment clients acknowledge with `table_ready`: the last chronicle event, so both sides
 * name it the same way (`tableMoment` from the protocol).
 */
export function momentOf(game: Pick<GameState, 'events'>): string {
  return tableMoment(game);
}

/** Pause before a decision that is just a card (or confirming the round). */
const BOT_SIMPLE_DELAY_MS = 900;
/** Pause before a decision with a target or the Chancellor's choice. */
const BOT_TARGET_DELAY_MS = 2200;
/** Extra pause after something visible happened, when nobody can tell us the table settled. */
const BOT_AFTER_EVENT_MS = 5000;
/** How long a bot waits for every screen to settle before moving anyway. */
export const BOT_HOLD_MAX_MS = 30_000;
/** Beat between the last screen settling and the bot moving. */
const BOT_READY_DELAY_MS = 700;

function isWeighty(action: Action): boolean {
  return (
    action.type === 'chancellor_keep' || (action.type === 'play_card' && Boolean(action.targetId))
  );
}

/**
 * When the next bot should move, paced to what just happened at the table. After every new
 * event the bot waits until each connected human has told us their screen finished the reveal
 * and the remarks (`table_ready`), or a timeout; without humans to wait for, it just waits.
 */
export function planBotMove(data: RoomData, ctx: RoomContext): void {
  const game = data.game;
  const move = game ? nextBotMove(data, () => 0.5) : null;
  if (!game || !move) {
    data.botDueAt = null;
    data.hold = null;
    return;
  }
  const moment = momentOf(game);
  const newMoment = moment !== data.botSeenMoment;
  data.botSeenMoment = moment;
  const weighty = isWeighty(move.action);
  const waiting = data.seats.filter(
    (s) => !s.bot && !s.left && game.players.some((p) => p.id === s.id) && ctx.connected.has(s.id),
  );

  if (newMoment) {
    if (waiting.length > 0 && move.action.type !== 'continue_round') {
      data.hold = { moment, seats: [] };
      data.botDueAt = ctx.now + BOT_HOLD_MAX_MS;
      return;
    }
    data.hold = null;
    data.botDueAt =
      ctx.now +
      (weighty ? BOT_TARGET_DELAY_MS : BOT_SIMPLE_DELAY_MS) +
      BOT_AFTER_EVENT_MS +
      Math.floor(ctx.random() * 600);
    return;
  }
  if (data.hold) {
    if (waiting.every((s) => data.hold?.seats.includes(s.id))) {
      data.hold = null;
      data.botDueAt =
        ctx.now +
        BOT_READY_DELAY_MS +
        (weighty ? BOT_TARGET_DELAY_MS - BOT_SIMPLE_DELAY_MS : 0) +
        Math.floor(ctx.random() * 600);
    }
    return;
  }
  if (data.botDueAt) return;
  data.botDueAt =
    ctx.now +
    (weighty ? BOT_TARGET_DELAY_MS : BOT_SIMPLE_DELAY_MS) +
    Math.floor(ctx.random() * 600);
}

function notesOf(data: RoomData, botId: string): BotNotes {
  return data.botNotes?.[botId] ?? emptyBotNotes();
}

/** Bots comment on what just happened: those involved first, then a few onlookers. */
function botsReact(data: RoomData, before: GameState, ctx: RoomContext): void {
  const game = data.game;
  if (!game) return;
  const bots = data.seats.filter((s) => s.bot && game.players.some((p) => p.id === s.id));
  if (bots.length === 0) return;

  for (const event of botEvents(before, game)) {
    const remarks = bots
      .map((seat) => ({
        seat,
        remark: botRemark(viewFor(game, seat.id), notesOf(data, seat.id), event, ctx.random),
      }))
      .filter((r) => r.remark !== null)
      .sort((a, b) => Number(b.remark?.involved) - Number(a.remark?.involved));
    // Two bots saying the same thing at the same moment reads as a glitch: one line per text,
    // also against what was just said under this same event.
    const key = eventKey(event);
    const spoken = new Set(
      (data.chat ?? []).filter((line) => line.after === key).map((line) => line.text),
    );
    let said = 0;
    for (const { seat, remark } of remarks) {
      if (said >= REMARKS_PER_EVENT) break;
      if (!remark || spoken.has(remark.text)) continue;
      say(data, seat.id, remark.text, key);
      // The bot remembers what it said, so it does not repeat itself in later turns.
      data.botNotes = { ...data.botNotes, [seat.id]: remark.notes };
      spoken.add(remark.text);
      said++;
    }
  }

  if (game.phase === 'game_over' && before.phase !== 'game_over')
    sayFarewells(data, game, bots, ctx);
}

/** A few bots have the last word: the winners first, then anyone. */
function sayFarewells(data: RoomData, game: GameState, bots: Seat[], ctx: RoomContext): void {
  const ordered = bots
    .map((seat) => ({ seat, order: (game.winnerIds.includes(seat.id) ? 0 : 1) + ctx.random() }))
    .sort((a, b) => a.order - b.order);
  const said = new Set<string>();
  for (const { seat } of ordered) {
    if (said.size >= FAREWELLS) break;
    // A few tries for a line nobody said yet: three identical goodbyes are not funny.
    for (let attempt = 0; attempt < 6; attempt++) {
      const text = botFarewell(viewFor(game, seat.id), notesOf(data, seat.id), ctx.random);
      if (!text) break;
      if (said.has(text)) continue;
      say(data, seat.id, text, null, true);
      said.add(text);
      break;
    }
  }
}

function say(
  data: RoomData,
  playerId: string,
  text: string,
  after: string | null,
  final = false,
): void {
  const id = data.nextChatId ?? 1;
  data.nextChatId = id + 1;
  const line: ChatLine = final
    ? { id, playerId, text, after, final }
    : { id, playerId, text, after };
  data.chat = [...(data.chat ?? []), line].slice(-MAX_CHAT_LINES);
}
