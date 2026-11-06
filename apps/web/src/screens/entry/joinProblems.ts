import {
  cleanName,
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  ROOM_CODE_LENGTH,
  type RoomErrorCode,
  type RoomInfo,
} from '@loveletter/protocol';
import { ApiRequestError } from '../../lib/api';

/** Por qué alguien no puede sentarse a una mesa. */
export type JoinProblem =
  | { kind: 'incomplete' }
  | { kind: 'invalid' }
  | { kind: 'not_found' }
  | { kind: 'full' }
  | { kind: 'started' }
  | { kind: 'network'; message: string };

export function problemCopy(problem: JoinProblem): { title: string; message: string } {
  switch (problem.kind) {
    case 'incomplete':
      return {
        title: 'El código está incompleto',
        message: `Los códigos tienen ${ROOM_CODE_LENGTH} caracteres, como KX7-QM2. Revisa el mensaje del anfitrión.`,
      };
    case 'invalid':
      return {
        title: 'Ese código no es válido',
        message:
          'Los códigos usan letras y números, sin 0, O, 1 ni I, como KX7-QM2. Revisa el mensaje del anfitrión.',
      };
    case 'not_found':
      return {
        title: 'No encontramos esa sala',
        message: 'Puede que el código tenga un error o que la sala ya se haya cerrado.',
      };
    case 'full':
      return {
        title: 'La mesa está completa',
        message: `Esta sala ya tiene ${MAX_PLAYERS} jugadores, el máximo de Love Letter.`,
      };
    case 'started':
      return {
        title: 'La partida ya comenzó',
        message:
          'No se puede entrar a mitad de partida. Si estabas jugando y perdiste la conexión, vuelve con el mismo dispositivo para retomar tu asiento.',
      };
    case 'network':
      return { title: 'No pudimos contactar con la sala', message: problem.message };
  }
}

export function codeFormatProblem(raw: string): JoinProblem {
  const stripped = raw.replace(/[\s-]/g, '');
  return stripped.length !== ROOM_CODE_LENGTH ? { kind: 'incomplete' } : { kind: 'invalid' };
}

export function roomInfoProblem(info: RoomInfo): JoinProblem | null {
  if (info.status !== 'lobby') return { kind: 'started' };
  if (!info.joinable) return { kind: 'full' };
  return null;
}

export function requestProblem(error: unknown): JoinProblem {
  if (error instanceof ApiRequestError) {
    if (error.code === 'room_not_found' || error.status === 404) return { kind: 'not_found' };
    if (error.code === 'network') {
      return {
        kind: 'network',
        message: 'Sin conexión con el servidor. Revisa tu red y reintenta.',
      };
    }
    return { kind: 'network', message: error.message };
  }
  return { kind: 'network', message: 'Algo salió mal, inténtalo de nuevo.' };
}

/** Errores de unión que significan que la sala está cerrada para nosotros (no es el nombre). */
export function joinErrorProblem(code: RoomErrorCode | 'network'): JoinProblem | null {
  switch (code) {
    case 'room_full':
      return { kind: 'full' };
    case 'game_in_progress':
      return { kind: 'started' };
    case 'room_not_found':
      return { kind: 'not_found' };
    default:
      return null;
  }
}

export function isNameError(code: RoomErrorCode | 'network'): boolean {
  return code === 'name_taken' || code === 'bad_message';
}

export const NAME_HINT = `Entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres.`;

export function nameProblem(name: string): string | null {
  const clean = cleanName(name);
  if (clean.length < NAME_MIN_LENGTH)
    return `El nombre necesita al menos ${NAME_MIN_LENGTH} caracteres.`;
  if (clean.length > NAME_MAX_LENGTH)
    return `El nombre puede tener como mucho ${NAME_MAX_LENGTH} caracteres.`;
  return null;
}
