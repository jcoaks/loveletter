import type { RoomInfo } from '@loveletter/protocol';

export interface ApiError {
  error: string;
  message?: string;
}

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiRequestError('network', 'No hay conexión con el servidor', 0);
  }
  const body = (await response.json().catch(() => null)) as T | ApiError | null;
  if (!response.ok) {
    const error = (body ?? { error: 'unknown' }) as ApiError;
    throw new ApiRequestError(
      error.error,
      error.message ?? 'Algo salió mal, inténtalo de nuevo',
      response.status,
    );
  }
  return body as T;
}

export interface CreatedRoom {
  code: string;
  playerId: string;
  seatToken: string;
}

export function createRoom(name: string): Promise<CreatedRoom> {
  return request('/api/rooms', { method: 'POST', body: JSON.stringify({ name }) });
}

/** Estado público de la sala; lanza ApiRequestError `room_not_found` (404) si no existe. */
export function getRoomInfo(code: string): Promise<RoomInfo> {
  return request(`/api/rooms/${encodeURIComponent(code)}`);
}

export function roomSocketUrl(code: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/rooms/${encodeURIComponent(code)}/ws`;
}
