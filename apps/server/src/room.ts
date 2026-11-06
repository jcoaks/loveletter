import { DurableObject } from 'cloudflare:workers';
import {
  CLOSE_CODES,
  type ClientMessage,
  type RoomErrorCode,
  type RoomInfo,
  type ServerMessage,
} from '@loveletter/protocol';
import { parseClientMessage } from '@loveletter/protocol/schema';
import { hashToken, randomSeatToken, secureRandom } from './crypto';
import {
  addSeat,
  connectSeat,
  createRoom,
  disconnectSeat,
  findSeatByTokenHash,
  handleMessage,
  pendingBot,
  planBotMove,
  playBot,
  type RoomContext,
  type RoomData,
  roomInfo,
  roomView,
} from './room-core';

/** Rooms with no activity for this long are deleted. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
/** Per-connection rate limit. */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 40;

interface Attachment {
  seatId: string | null;
}

export type CreateRoomResult =
  | { ok: true; seatToken: string; playerId: string }
  | { ok: false; code: RoomErrorCode; message: string };

/** One Durable Object per room: the single authority over its state and connections. */
export class Room extends DurableObject<Env> {
  private data: RoomData | null = null;
  private readonly rate = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.data = (await ctx.storage.get<RoomData>('room')) ?? null;
    });
  }

  // --- RPC from the Worker ---------------------------------------------------

  async create(code: string, hostName: string): Promise<CreateRoomResult> {
    if (this.data) return { ok: false, code: 'room_exists', message: 'La sala ya existe' };
    const data = createRoom(code, Date.now());
    const seatToken = randomSeatToken();
    const added = addSeat(data, hostName, await hashToken(seatToken), this.context());
    if (!added.ok) return added;
    this.data = data;
    await this.save();
    console.log(JSON.stringify({ event: 'room_created', room: code }));
    return { ok: true, seatToken, playerId: added.seat?.id as string };
  }

  async info(): Promise<RoomInfo | null> {
    return this.data ? roomInfo(this.data) : null;
  }

  // --- WebSockets ------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Se esperaba un WebSocket', { status: 426 });
    }
    if (!this.data) return new Response('Sala no encontrada', { status: 404 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seatId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const data = this.data;
    if (!data) return ws.close(CLOSE_CODES.roomClosed, 'Sala cerrada');
    if (!this.allow(ws)) return this.send(ws, errorMessage('rate_limited', 'Demasiados mensajes'));
    if (typeof raw !== 'string')
      return this.send(ws, errorMessage('bad_message', 'Mensaje inválido'));

    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.send(ws, errorMessage('bad_message', 'Mensaje inválido'));

    const { seatId } = ws.deserializeAttachment() as Attachment;
    if (parsed.message.type === 'join' && !seatId) return this.join(ws, data, parsed.message);
    if (!seatId) return this.send(ws, errorMessage('not_joined', 'Primero únete a la mesa'));

    const result = handleMessage(data, seatId, parsed.message, this.context());
    if (!result.ok) return this.send(ws, errorMessage(result.code, result.message));

    if (result.kicked) this.closeSeat(result.kicked, CLOSE_CODES.kicked, { type: 'kicked' });
    if (result.left) this.closeSeat(result.left, CLOSE_CODES.left);
    await this.commit();
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'Adiós');
    } catch {
      // Already closed.
    }
    await this.onSocketGone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.onSocketGone(ws);
  }

  override async alarm(): Promise<void> {
    const data = this.data;
    if (!data) return;
    if (pendingBot(data) && this.ctx.getWebSockets().length > 0) {
      if (Date.now() >= (data.botDueAt ?? 0) && playBot(data, this.context())) {
        data.botDueAt = null;
        await this.commit();
        return;
      }
    }
    const idle = Date.now() - data.lastActivity;
    if (idle >= ROOM_TTL_MS && this.ctx.getWebSockets().length === 0) {
      console.log(JSON.stringify({ event: 'room_deleted', room: data.code, reason: 'idle' }));
      this.data = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.schedule();
  }

  // --- Internals ---------------------------------------------------------------

  private async join(
    ws: WebSocket,
    data: RoomData,
    message: Extract<ClientMessage, { type: 'join' }>,
  ): Promise<void> {
    let seatId: string;
    let seatToken: string;

    if (message.seatToken) {
      const seat = findSeatByTokenHash(data, await hashToken(message.seatToken));
      if (!seat) return this.reject(ws, 'invalid_seat', 'Ese asiento ya no existe');
      seatId = seat.id;
      seatToken = message.seatToken;
    } else if (message.name) {
      seatToken = randomSeatToken();
      const added = addSeat(data, message.name, await hashToken(seatToken), this.context());
      if (!added.ok) return this.reject(ws, added.code, added.message);
      seatId = added.seat?.id as string;
    } else {
      return this.reject(ws, 'bad_message', 'Falta el nombre o el token de asiento');
    }

    // Attach first, so closing an older socket of the same seat is not seen as a disconnect.
    const previous = this.socketsOf(seatId);
    ws.serializeAttachment({ seatId } satisfies Attachment);
    // One live connection per seat: a new tab or device takes over.
    for (const other of previous) {
      other.serializeAttachment({ seatId: null } satisfies Attachment);
      other.close(CLOSE_CODES.replaced, 'Abierto en otra ventana');
    }
    connectSeat(data, seatId, this.context());
    this.send(ws, { type: 'welcome', playerId: seatId, seatToken });
    await this.commit();
  }

  private async onSocketGone(ws: WebSocket): Promise<void> {
    const data = this.data;
    const { seatId } = (ws.deserializeAttachment() as Attachment | null) ?? { seatId: null };
    if (!data || !seatId) return;
    const ctx = this.context(ws);
    if (ctx.connected.has(seatId)) return; // Still connected from another socket.
    disconnectSeat(data, seatId, ctx);
    await this.commit(ws);
  }

  /** Persists the room and sends every connected player their own view. */
  private async commit(closing?: WebSocket): Promise<void> {
    const data = this.data;
    if (!data) return;
    await this.save();
    const ctx = this.context(closing);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue;
      const { seatId } = ws.deserializeAttachment() as Attachment;
      if (seatId && data.seats.some((s) => s.id === seatId)) {
        this.send(ws, { type: 'room', room: roomView(data, seatId, ctx) });
      }
    }
  }

  private async save(): Promise<void> {
    if (!this.data) return;
    planBotMove(this.data, this.context());
    await this.ctx.storage.put('room', this.data);
    await this.schedule();
  }

  /** One alarm serves both the next bot move and the cleanup of idle rooms. */
  private async schedule(): Promise<void> {
    const data = this.data;
    if (!data) return;
    const cleanup = data.lastActivity + ROOM_TTL_MS;
    const botAt = data.botDueAt && pendingBot(data) ? data.botDueAt : null;
    await this.ctx.storage.setAlarm(botAt ? Math.min(botAt, cleanup) : cleanup);
  }

  private context(excluding?: WebSocket): RoomContext {
    const connected = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluding || ws.readyState !== WebSocket.OPEN) continue;
      const { seatId } = ws.deserializeAttachment() as Attachment;
      if (seatId) connected.add(seatId);
    }
    return { now: Date.now(), connected, random: secureRandom };
  }

  private socketsOf(seatId: string): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => (ws.deserializeAttachment() as Attachment).seatId === seatId);
  }

  private closeSeat(seatId: string, code: number, farewell?: ServerMessage): void {
    for (const ws of this.socketsOf(seatId)) {
      if (farewell) this.send(ws, farewell);
      ws.serializeAttachment({ seatId: null } satisfies Attachment);
      ws.close(code, 'Fuera de la mesa');
    }
  }

  private reject(ws: WebSocket, code: RoomErrorCode, message: string): void {
    this.send(ws, errorMessage(code, message));
    ws.close(CLOSE_CODES.badJoin, 'No se pudo entrar');
  }

  private allow(ws: WebSocket): boolean {
    const now = Date.now();
    const entry = this.rate.get(ws);
    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
      this.rate.set(ws, { windowStart: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= RATE_MAX_MESSAGES;
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // The socket closed mid-send; its close handler will clean up.
    }
  }
}

function errorMessage(code: RoomErrorCode, message: string): ServerMessage {
  return { type: 'error', code, message };
}
