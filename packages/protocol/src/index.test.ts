import { describe, expect, it } from 'vitest';
import {
  cleanName,
  formatRoomCode,
  MAX_MESSAGE_BYTES,
  normalizeRoomCode,
  tableMoment,
  toEngineAction,
} from './index';
import { createRoomSchema, parseClientMessage } from './schema';

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));
const ok = (value: unknown) => parse(value).ok;

describe('códigos de sala', () => {
  it('normaliza mayúsculas, guiones y espacios', () => {
    expect(normalizeRoomCode('kx7-qm2')).toBe('KX7QM2');
    expect(normalizeRoomCode(' KX7 QM2 ')).toBe('KX7QM2');
    expect(formatRoomCode('KX7QM2')).toBe('KX7-QM2');
  });

  it('rechaza longitudes erróneas y caracteres ambiguos', () => {
    expect(normalizeRoomCode('KX7-Q')).toBeNull();
    expect(normalizeRoomCode('KX0-QM2')).toBeNull();
    expect(normalizeRoomCode('KX1-QMI')).toBeNull();
  });
});

describe('nombres', () => {
  it('limpia espacios y caracteres de control', () => {
    expect(cleanName('  Ana \u0000  María\n')).toBe('Ana María');
  });

  it('aplica 2 a 20 caracteres tras limpiar', () => {
    expect(ok({ type: 'join', name: ' A ' })).toBe(false);
    expect(ok({ type: 'join', name: 'Al' })).toBe(true);
    expect(ok({ type: 'join', name: 'x'.repeat(20) })).toBe(true);
    expect(ok({ type: 'join', name: 'x'.repeat(21) })).toBe(false);
    expect(ok({ type: 'join', name: 'x'.repeat(500) })).toBe(false);
    expect(ok({ type: 'join', name: '\u0000\u0001  ' })).toBe(false);
    const r = parse({ type: 'join', name: '  Lucía  ' });
    expect(r.ok && r.message).toEqual({ type: 'join', name: 'Lucía' });
  });

  it('también se aplica al crear sala', () => {
    expect(createRoomSchema.safeParse({ name: 'Marta' }).success).toBe(true);
    expect(createRoomSchema.safeParse({ name: 'M' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ name: 'Marta', extra: 1 }).success).toBe(false);
  });
});

describe('mensajes del cliente', () => {
  it('acepta acciones de juego válidas', () => {
    expect(
      ok({ type: 'action', action: { type: 'play_card', card: 1, targetId: 'p1', guess: 0 } }),
    ).toBe(true);
    expect(ok({ type: 'action', action: { type: 'play_card', card: 0 } })).toBe(true);
    expect(
      ok({ type: 'action', action: { type: 'chancellor_keep', keep: 4, bottomOrder: [1, 2] } }),
    ).toBe(true);
    expect(ok({ type: 'action', action: { type: 'continue_round' } })).toBe(true);
  });

  it('acepta el resto de mensajes', () => {
    for (const m of [
      { type: 'set_ready', ready: true },
      { type: 'configure', config: { bots: 3 } },
      { type: 'configure', config: {} },
      { type: 'kick', playerId: 'p1' },
      { type: 'start' },
      { type: 'table_ready', moment: 'ev-12' },
      { type: 'declare_play', card: 1 },
      { type: 'declare_target', targetId: 'p1' },
      { type: 'leave' },
      { type: 'end_game' },
      { type: 'new_game' },
    ]) {
      expect(ok(m)).toBe(true);
    }
  });

  it('rechaza JSON inválido, tipos desconocidos y campos de más', () => {
    expect(parseClientMessage('{').ok).toBe(false);
    expect(parseClientMessage('null').ok).toBe(false);
    expect(parseClientMessage('[]').ok).toBe(false);
    expect(ok({ type: 'hack' })).toBe(false);
    expect(ok({})).toBe(false);
    expect(ok({ type: 'start', extra: 1 })).toBe(false);
    expect(ok({ type: 'action', action: { type: 'continue_round', playerId: 'x' } })).toBe(false);
    expect(ok({ type: 'action', action: { type: 'vote', approve: true } })).toBe(false);
    expect(ok({ type: 'action' })).toBe(false);
  });

  it('valida cartas, acusaciones y orden del Canciller', () => {
    const play = (extra: object) => ok({ type: 'action', action: { type: 'play_card', ...extra } });
    expect(play({ card: 10 })).toBe(false);
    expect(play({ card: -1 })).toBe(false);
    expect(play({ card: 1.5 })).toBe(false);
    expect(play({ card: '1' })).toBe(false);
    expect(play({})).toBe(false);
    expect(play({ card: 1, guess: 10 })).toBe(false);
    expect(play({ card: 1, targetId: '' })).toBe(false);
    expect(play({ card: 1, targetId: 'x'.repeat(65) })).toBe(false);
    const keep = (bottomOrder: unknown, k: unknown = 1) =>
      ok({ type: 'action', action: { type: 'chancellor_keep', keep: k, bottomOrder } });
    expect(keep([1, 2, 3])).toBe(false);
    expect(keep([11])).toBe(false);
    expect(keep('12')).toBe(false);
    expect(keep([1], 'a')).toBe(false);
    expect(keep([])).toBe(true);
  });

  it('limita las opciones de configuración', () => {
    expect(ok({ type: 'configure', config: { bots: 5 } })).toBe(true);
    expect(ok({ type: 'configure', config: { bots: 6 } })).toBe(false);
    expect(ok({ type: 'configure', config: { bots: -1 } })).toBe(false);
    expect(ok({ type: 'configure', config: { bots: 1.5 } })).toBe(false);
    expect(ok({ type: 'configure', config: { cheats: true } })).toBe(false);
    expect(ok({ type: 'configure' })).toBe(false);
  });

  it('exige tokens de asiento con formato correcto', () => {
    expect(ok({ type: 'join', seatToken: 'a'.repeat(32) })).toBe(true);
    expect(ok({ type: 'join', seatToken: 'nope' })).toBe(false);
    expect(ok({ type: 'join', seatToken: 'A'.repeat(32) })).toBe(false);
  });

  it('rechaza mensajes demasiado grandes', () => {
    const big = JSON.stringify({ type: 'join', name: 'Ana', pad: 'x'.repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big).ok).toBe(false);
  });

  it('table_ready limita el tamaño del momento', () => {
    expect(ok({ type: 'table_ready', moment: '' })).toBe(false);
    expect(ok({ type: 'table_ready', moment: 'x'.repeat(65) })).toBe(false);
  });
});

describe('toEngineAction', () => {
  it('añade el jugador que envía, sin dejar que el cliente lo elija', () => {
    const r = parse({ type: 'action', action: { type: 'play_card', card: 5, targetId: 'p2' } });
    if (!r.ok || r.message.type !== 'action') throw new Error('mensaje inválido');
    expect(toEngineAction('p1', r.message.action)).toEqual({
      type: 'play_card',
      card: 5,
      targetId: 'p2',
      playerId: 'p1',
    });
  });
});

describe('tableMoment', () => {
  it('nombra el último suceso de la crónica', () => {
    expect(tableMoment({ events: [] })).toBe('ev-0');
    expect(tableMoment({ events: [{ id: 1 }, { id: 2 }, { id: 7 }] })).toBe('ev-7');
  });
});
