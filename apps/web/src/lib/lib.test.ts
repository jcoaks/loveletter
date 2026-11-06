import { describe, expect, it } from 'vitest';
import { agree } from './gender';
import { cleanName, shortName } from './names';
import { seatChips } from './seat';

describe('género', () => {
  it('concuerda y cae a masculino', () => {
    expect(agree('Eliminado', 'f')).toBe('Eliminada');
    expect(agree('Protegido', 'x')).toBe('Protegide');
    expect(agree('Eliminado')).toBe('Eliminado');
    expect(agree('Eliminado', 'm')).toBe('Eliminado');
  });
  it('los chips de asiento concuerdan', () => {
    const base = { id: 'a', name: 'A', handCount: 1, discards: [], tokens: 0 } as const;
    expect(
      seatChips({ ...base, gender: 'f', protected: true, connected: false }).map((c) => c.label),
    ).toEqual(['Protegida', 'Desconectada']);
  });
});

describe('nombres', () => {
  it('limpia espacios y recorta', () => {
    expect(cleanName('  Ana   María ')).toBe('Ana María');
    expect(shortName('Maximiliano Fernández', 8)).toBe('Maximil…');
  });
});
