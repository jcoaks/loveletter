import { type CardValue, cardName } from './cards';
import { agree, type Gender } from './gender';
import { plural } from './names';

/** Datos de un asiento tal como los necesita la capa visual (independiente del protocolo). */
export interface SeatData {
  id: string;
  name: string;
  gender?: Gender;
  /** Cartas en mano (los rivales solo muestran reversos). */
  handCount: number;
  /** Descartes en orden, del más antiguo al más reciente. */
  discards: readonly CardValue[];
  tokens: number;
  eliminated?: boolean;
  protected?: boolean;
  spyPlayed?: boolean;
  /** Por omisión se asume conectado. */
  connected?: boolean;
  bot?: boolean;
  isTurn?: boolean;
  /** Reversos que aún reciben una carta en vuelo: ocupan su sitio pero no se ven. */
  hiddenBacks?: number;
}

export interface SeatChip {
  label: string;
  /** Resaltado (turno). */
  on?: boolean;
}

export function seatChips(seat: SeatData): SeatChip[] {
  const chips: SeatChip[] = [];
  if (seat.eliminated) chips.push({ label: agree('Eliminado', seat.gender) });
  if (seat.protected) chips.push({ label: agree('Protegido', seat.gender) });
  if (seat.spyPlayed) chips.push({ label: 'Espía jugado' });
  if (seat.connected === false) chips.push({ label: agree('Desconectado', seat.gender) });
  if (seat.bot) chips.push({ label: 'Bot' });
  if (seat.isTurn) chips.push({ label: 'Su turno', on: true });
  return chips;
}

export const discardsText = (discards: readonly CardValue[]): string =>
  discards.map(cardName).join(', ') || 'ninguno';

/** Texto accesible de un asiento rival. */
export function seatLabel(seat: SeatData, toWin: number, clickable = true): string {
  const info = [
    seat.eliminated && agree('eliminado', seat.gender),
    seat.protected && agree('protegido', seat.gender),
    seat.spyPlayed && 'espía jugado',
    seat.connected === false && agree('desconectado', seat.gender),
    seat.bot && 'bot',
    seat.isTurn && 'es su turno',
  ].filter(Boolean);
  const hand = seat.eliminated
    ? 'Sin cartas'
    : plural(seat.handCount, 'carta en mano', 'cartas en mano');
  return `${seat.name}${info.length ? `, ${info.join(', ')}` : ''}. ${hand}. Descartes: ${discardsText(seat.discards)}. ${seat.tokens} de ${toWin} fichas.${clickable ? ' Ver descartes' : ''}`;
}
