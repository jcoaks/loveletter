// Zod schemas for validating client input. Server-only: browsers import the
// lightweight types and helpers from '@loveletter/protocol' instead.
import { z } from 'zod';
import {
  type ClientMessage,
  cleanName,
  MAX_BOTS,
  MAX_MESSAGE_BYTES,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  SEAT_TOKEN_PATTERN,
} from './index';

const playerName = z
  .string()
  .max(100)
  .transform(cleanName)
  .pipe(z.string().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH));

const playerId = z.string().min(1).max(64);
const cardValue = z.number().int().min(0).max(9);

// ---------------------------------------------------------------------------
// Client → server

/** The engine's `Action`s without `playerId`: the server knows who is talking. */
export const gameActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('play_card'),
    card: cardValue,
    targetId: playerId.optional(),
    guess: cardValue.optional(),
  }),
  z.strictObject({
    type: z.literal('chancellor_keep'),
    keep: cardValue,
    bottomOrder: z.array(cardValue).max(2),
  }),
  z.strictObject({ type: z.literal('continue_round') }),
]);

/** Partial update of the room options; omitted fields stay as they are. */
export const roomConfigPatchSchema = z.strictObject({
  bots: z.number().int().min(0).max(MAX_BOTS).optional(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  /** First message on every connection: a new seat by name, or an existing seat by token. */
  z.strictObject({
    type: z.literal('join'),
    name: playerName.optional(),
    seatToken: z.string().regex(SEAT_TOKEN_PATTERN).optional(),
  }),
  z.strictObject({ type: z.literal('set_ready'), ready: z.boolean() }),
  /** Host only, in the lobby. */
  z.strictObject({ type: z.literal('configure'), config: roomConfigPatchSchema }),
  z.strictObject({ type: z.literal('kick'), playerId }),
  z.strictObject({ type: z.literal('start') }),
  z.strictObject({ type: z.literal('action'), action: gameActionSchema }),
  /** Commit the card you are about to play (one that asks for a target) before choosing the target. */
  z.strictObject({ type: z.literal('declare_play'), card: cardValue }),
  /** Guard only: tell the table whom you accuse before naming the card. */
  z.strictObject({ type: z.literal('declare_target'), targetId: playerId }),
  /** This screen has shown everything about `moment` (reveals, remarks): bots may move. */
  z.strictObject({ type: z.literal('table_ready'), moment: z.string().min(1).max(64) }),
  z.strictObject({ type: z.literal('leave') }),
  z.strictObject({ type: z.literal('end_game') }),
  z.strictObject({ type: z.literal('new_game') }),
]);

export const createRoomSchema = z.strictObject({ name: playerName });

/** Parses a raw WebSocket payload; never throws. */
export function parseClientMessage(
  raw: string,
): { ok: true; message: ClientMessage } | { ok: false } {
  if (raw.length > MAX_MESSAGE_BYTES) return { ok: false };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const parsed = clientMessageSchema.safeParse(json);
  return parsed.success ? { ok: true, message: parsed.data } : { ok: false };
}
