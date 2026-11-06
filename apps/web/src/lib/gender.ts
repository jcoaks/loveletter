/** Género gramatical con el que se concuerdan los estados de un jugador. Ausente: masculino. */
export type Gender = 'f' | 'm' | 'x';

/**
 * Concuerda un adjetivo o participio en masculino singular ("Eliminado") con el género.
 * 'f' → "Eliminada", 'x' → "Eliminade"; sin género o 'm' queda igual.
 */
export function agree(word: string, gender?: Gender): string {
  if (!gender || gender === 'm' || !word.endsWith('o')) return word;
  return `${word.slice(0, -1)}${gender === 'f' ? 'a' : 'e'}`;
}
