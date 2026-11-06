/** Nombre normalizado: sin espacios sobrantes y sin saltos de línea. */
export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim();

/** Recorta un nombre largo con puntos suspensivos sin partir pares sustitutos. */
export function shortName(name: string, max = 14): string {
  const chars = Array.from(cleanName(name));
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`;
}

/** "Marta" o "Marta (tú)". */
export const labelName = (name: string, isMe = false): string =>
  isMe ? `${cleanName(name)} (tú)` : cleanName(name);

/** "1 carta" / "3 cartas". */
export const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;
