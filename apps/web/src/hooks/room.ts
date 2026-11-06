import type { PlayerView } from '@loveletter/engine';
import type { RoomView } from '@loveletter/protocol';
import { useRoomStore } from '../store/room';

/** La sala actual. Solo dentro de pantallas que se muestran con la sala ya cargada. */
export function useRoom(): RoomView {
  const room = useRoomStore((s) => s.room);
  if (!room) throw new Error('useRoom() se usó antes de cargar la sala');
  return room;
}

export function useGame(): PlayerView {
  const game = useRoomStore((s) => s.room?.game);
  if (!game) throw new Error('useGame() se usó fuera de una partida');
  return game;
}

/** Verdadero cuando se pueden enviar acciones (conectado, vista fresca, sin pausa). */
export function useCanAct(): boolean {
  return useRoomStore((s) => s.status === 'open' && !s.room?.pause);
}
