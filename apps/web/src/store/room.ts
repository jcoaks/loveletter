import {
  CLOSE_CODES,
  type ClientMessage,
  type GameActionMessage,
  normalizeRoomCode,
  type RoomErrorCode,
  type RoomView,
  type ServerMessage,
} from '@loveletter/protocol';
import ReconnectingWebSocket from 'partysocket/ws';
import { create } from 'zustand';
import { roomSocketUrl } from '../lib/api';
import { seatToken } from '../lib/session';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Why the server ended our connection for good. */
export type ClosedReason = 'kicked' | 'left' | 'replaced' | 'rejected' | null;

export interface RoomNotice {
  id: number;
  code: RoomErrorCode | 'network';
  message: string;
}

interface RoomStore {
  /** Normalized room code ("KX7QM2") of the current connection. */
  code: string | null;
  playerId: string | null;
  status: ConnectionStatus;
  room: RoomView | null;
  /** Last error from the server, shown as a toast; cleared by `dismissNotice`. */
  notice: RoomNotice | null;
  closedReason: ClosedReason;
  /** Error that prevented joining (bad name, full room…), for the join screens. */
  joinError: RoomNotice | null;

  connect(code: string, join?: { name: string }): void;
  disconnect(): void;
  send(message: ClientMessage): boolean;
  act(action: GameActionMessage): boolean;
  leave(): void;
  dismissNotice(): void;
}

let socket: ReconnectingWebSocket | null = null;
let pendingName: string | null = null;
let noticeId = 0;

export const useRoomStore = create<RoomStore>((set, get) => {
  function notice(code: RoomNotice['code'], message: string): RoomNotice {
    noticeId += 1;
    return { id: noticeId, code, message };
  }

  function stop(reason: ClosedReason): void {
    socket?.close();
    socket = null;
    pendingName = null;
    set({ status: 'closed', closedReason: reason });
  }

  function onMessage(event: MessageEvent): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      return;
    }
    const code = get().code;
    switch (message.type) {
      case 'welcome':
        if (code) seatToken.set(code, message.seatToken);
        pendingName = null;
        set({ playerId: message.playerId, joinError: null });
        return;
      case 'room':
        set({ room: message.room, status: 'open' });
        return;
      case 'error':
        if (!get().playerId) {
          // Joining failed: a stale seat token is forgotten so the player can rejoin by name.
          if (code && message.code === 'invalid_seat') seatToken.clear(code);
          set({ joinError: notice(message.code, message.message) });
        } else {
          set({ notice: notice(message.code, message.message) });
        }
        return;
      case 'kicked':
        if (code) seatToken.clear(code);
        stop('kicked');
        return;
    }
  }

  function onOpen(): void {
    const code = get().code;
    if (!code || !socket) return;
    const token = seatToken.get(code);
    // Never act on a view from a previous connection: wait for a fresh one.
    set({ status: get().room ? 'reconnecting' : 'connecting' });
    if (token) socket.send(JSON.stringify({ type: 'join', seatToken: token }));
    else if (pendingName) socket.send(JSON.stringify({ type: 'join', name: pendingName }));
  }

  /** Close codes after which reconnecting would not help. */
  const FINAL_CLOSES: Record<number, ClosedReason> = {
    [CLOSE_CODES.kicked]: 'kicked',
    [CLOSE_CODES.left]: 'left',
    [CLOSE_CODES.replaced]: 'replaced',
    [CLOSE_CODES.badJoin]: 'rejected',
    [CLOSE_CODES.roomClosed]: 'rejected',
  };

  function onClose(event: CloseEvent): void {
    const code = get().code;
    const reason = FINAL_CLOSES[event.code];
    if (reason) {
      // Kicked or left on purpose: the seat is gone, so its token is useless.
      if (code && (reason === 'kicked' || reason === 'left')) seatToken.clear(code);
      stop(reason);
    } else if (get().status !== 'closed') {
      set({ status: get().room ? 'reconnecting' : 'connecting' });
    }
  }

  return {
    code: null,
    playerId: null,
    status: 'idle',
    room: null,
    notice: null,
    closedReason: null,
    joinError: null,

    connect(rawCode, join) {
      const code = normalizeRoomCode(rawCode);
      if (!code) {
        set({ joinError: notice('room_not_found', 'Ese código de sala no es válido') });
        return;
      }
      if (socket && get().code === code && !join) return;
      socket?.close();
      pendingName = join?.name ?? null;
      set({
        code,
        playerId: null,
        room: null,
        status: 'connecting',
        notice: null,
        joinError: null,
        closedReason: null,
      });
      socket = new ReconnectingWebSocket(roomSocketUrl(code), [], {
        minReconnectionDelay: 500,
        maxReconnectionDelay: 5000,
        maxEnqueuedMessages: 0,
      });
      socket.addEventListener('open', onOpen);
      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
    },

    disconnect() {
      socket?.close();
      socket = null;
      pendingName = null;
      set({
        code: null,
        playerId: null,
        room: null,
        status: 'idle',
        notice: null,
        closedReason: null,
      });
    },

    send(message) {
      if (!socket || get().status !== 'open') {
        set({ notice: notice('network', 'Sin conexión: espera a que vuelva la conexión') });
        return false;
      }
      socket.send(JSON.stringify(message));
      return true;
    },

    act(action) {
      return get().send({ type: 'action', action });
    },

    leave() {
      get().send({ type: 'leave' });
    },

    dismissNotice() {
      set({ notice: null });
    },
  };
});
