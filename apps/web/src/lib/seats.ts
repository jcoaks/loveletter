import type { PlayerView } from '@loveletter/engine';
import type { RoomView } from '@loveletter/protocol';
import type { PickerPlayer } from '../components/PlayerPickerModal';
import type { SeatData } from './seat';

export interface TableSeats {
  me: SeatData;
  /** Rivales en el sentido de la mesa, empezando por el que está a tu izquierda. */
  rivals: SeatData[];
}

/** Convierte la vista del motor y la sala en los datos que dibuja la mesa. Nunca incluye manos ajenas. */
export function seatsOf(game: PlayerView, room: RoomView): TableSeats {
  const info = new Map(room.players.map((p) => [p.id, p]));
  const toSeat = (p: PlayerView['players'][number]): SeatData => {
    const r = info.get(p.id);
    return {
      id: p.id,
      name: p.name,
      handCount: p.handSize,
      discards: p.discards,
      tokens: p.tokens,
      eliminated: p.eliminated,
      protected: p.protected,
      spyPlayed: p.spyPlayed,
      bot: p.bot,
      // Un bot siempre está presente; un humano que se fue o se cayó se marca.
      connected: p.bot ? true : r ? r.connected && !r.left : true,
      isTurn: p.isActive && game.phase !== 'round_over' && game.phase !== 'game_over',
    };
  };
  const all = game.players;
  const mySeat = all.findIndex((p) => p.id === game.you.id);
  const ordered = [...all.slice(mySeat + 1), ...all.slice(0, mySeat)];
  const me = all[mySeat];
  if (!me) throw new Error('La vista no incluye tu asiento');
  return { me: toSeat(me), rivals: ordered.map(toSeat) };
}

/** Jugadores elegibles para una carta, según `targets` del motor. */
export function pickerPlayers(
  game: PlayerView,
  seats: TableSeats,
  targets: readonly string[],
): PickerPlayer[] {
  return [seats.me, ...seats.rivals].map((s) => ({
    id: s.id,
    name: s.name,
    isMe: s.id === game.you.id,
    eligible: targets.includes(s.id),
    eliminated: s.eliminated,
    discards: s.discards,
    tokens: s.tokens,
  }));
}
