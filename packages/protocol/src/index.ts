import {
  type Action,
  type ErrorCode as EngineErrorCode,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PlayerView,
} from '@loveletter/engine';
import type { z } from 'zod';
import type { clientMessageSchema, createRoomSchema, gameActionSchema } from './schema';

// ---------------------------------------------------------------------------
// Room codes: "KX7-QM2". No 0/O or 1/I, so they can be read aloud.

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

/** Uppercases and strips separators; returns null if it cannot be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== ROOM_CODE_LENGTH) return null;
  for (const char of raw) if (!ROOM_CODE_ALPHABET.includes(char)) return null;
  return raw;
}

export function formatRoomCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// ---------------------------------------------------------------------------
// Limits

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 20;
export const HOST_CAN_END_AFTER_MS = 120 * 1000;
export const MAX_MESSAGE_BYTES = 2048;
export const SEAT_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
/** Most bots the host may ask for (the table holds MAX_PLAYERS in total). */
export const MAX_BOTS = MAX_PLAYERS - 1;
export { MAX_PLAYERS, MIN_PLAYERS };

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Collapses whitespace and strips control characters before length checks. */
export function cleanName(name: string): string {
  return name.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
}

// Message types are inferred from the Zod schemas in ./schema, imported type-only
// so that browsers using this module do not bundle Zod.

/** An engine action as sent by a client: no `playerId` (the server fills in the sender). */
export type GameActionMessage = z.infer<typeof gameActionSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type CreateRoomRequest = z.infer<typeof createRoomSchema>;

/** Attaches the sender to a validated client action, producing the engine's `Action`. */
export function toEngineAction(playerId: string, message: GameActionMessage): Action {
  return { ...message, playerId } as Action;
}

/**
 * Names the point the table has reached: the last chronicle event. Both sides compute it from
 * the event list (server state or `PlayerView`) so `table_ready.moment` can be matched exactly.
 */
export function tableMoment(game: { events: readonly { id: number }[] }): string {
  const last = game.events[game.events.length - 1];
  return `ev-${last ? last.id : 0}`;
}

// ---------------------------------------------------------------------------
// Server → client

export type RoomErrorCode =
  | EngineErrorCode
  | 'bad_message'
  | 'rate_limited'
  | 'not_joined'
  | 'already_joined'
  | 'invalid_seat'
  | 'name_taken'
  | 'room_full'
  | 'game_in_progress'
  | 'not_host'
  | 'not_in_lobby'
  | 'not_playing'
  | 'not_enough_players'
  | 'not_everyone_ready'
  | 'invalid_config'
  | 'game_paused'
  | 'not_paused_long_enough'
  | 'room_not_found'
  | 'room_exists';

/** `paused`: a human dropped mid-game; `pause` in the view says who and since when. */
export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface RoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  /** Left a game in progress; their seat stays until the game ends. */
  left: boolean;
  /** A computer player added by the host. */
  bot: boolean;
  host: boolean;
}

/** Room options the host can change in the lobby. Add new options here (and in the schema). */
export interface RoomConfig {
  /** Computer players that fill the table. Humans + bots must be 2..6 to start. */
  bots: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = { bots: 0 };

/** Something a bot said at the table. */
export interface ChatLine {
  id: number;
  playerId: string;
  text: string;
  /** Key of the chronicle entry it comments on (`eventKey(event)` from the engine), or null. */
  after: string | null;
  /** A farewell once the game is over, shown on the end screen. */
  final?: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  you: { id: string; isHost: boolean };
  hostId: string | null;
  players: RoomPlayer[];
  config: RoomConfig;
  /** Table size limits for this edition. */
  limits: { minPlayers: number; maxPlayers: number };
  /** The host may press start: enough seats, everybody ready. */
  canStart: boolean;
  /** This player's engine view; null in the lobby. */
  game: PlayerView | null;
  /** The latest bot remarks, oldest first. */
  chat: ChatLine[];
  /** Set exactly when `status === 'paused'`. Timestamps are epoch milliseconds. */
  pause: { disconnectedIds: string[]; since: number; hostCanEndAt: number } | null;
}

export interface RoomInfo {
  code: string;
  status: RoomStatus;
  playerCount: number;
  joinable: boolean;
  /** Names at the table, for the invitation screen (anyone with the code can see them). */
  playerNames: string[];
  hostName: string | null;
}

export type ServerMessage =
  | { type: 'welcome'; playerId: string; seatToken: string }
  | { type: 'room'; room: RoomView }
  | { type: 'error'; code: RoomErrorCode; message: string }
  | { type: 'kicked' };

/** WebSocket close codes used by the room. */
export const CLOSE_CODES = {
  replaced: 4000,
  kicked: 4001,
  left: 4002,
  roomClosed: 4003,
  badJoin: 4004,
} as const;
