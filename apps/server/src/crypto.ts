import type { Random } from '@loveletter/engine';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@loveletter/protocol';

/** Uniform float in [0, 1) from the platform CSPRNG, for shuffling and picking the first player. */
export const secureRandom: Random = () => {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return (value as number) / 2 ** 32;
};

export function randomRoomCode(): string {
  // 256 is a multiple of 32 (the alphabet size), so taking the low bits is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

/** 128-bit secret that lets a player reclaim their seat. */
export function randomSeatToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
