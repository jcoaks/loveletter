// Memoria por navegador. El almacenamiento puede faltar o fallar (modo privado, datos
// bloqueados): todo acceso está protegido y la app funciona sin él.

const SEAT_PREFIX = 'loveletter:seat:';
const NAME_KEY = 'loveletter:name';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Se ignora: la app sigue funcionando en esta pestaña.
  }
}

/** Los códigos de sala se guardan normalizados ("KX7QM2"). */
export const seatToken = {
  get: (code: string) => read(SEAT_PREFIX + code),
  set: (code: string, token: string) => write(SEAT_PREFIX + code, token),
  clear: (code: string) => write(SEAT_PREFIX + code, null),
};

export const lastName = {
  get: () => read(NAME_KEY) ?? '',
  set: (name: string) => write(NAME_KEY, name),
};

export type NoticeMode = 'full' | 'brief';

/** Avisos de jugadas ajenas: ventana completa (por omisión) o solo un aviso breve. */
export const noticeModePref = {
  get: (): NoticeMode => (read('loveletter:notices') === 'brief' ? 'brief' : 'full'),
  set: (mode: NoticeMode) => write('loveletter:notices', mode === 'brief' ? 'brief' : null),
};

/** Vibración al llegar tu turno (solo teléfonos que la admiten): apagada por omisión. */
export const hapticsPref = {
  get: (): boolean => read('loveletter:haptics') === 'on',
  set: (on: boolean) => write('loveletter:haptics', on ? 'on' : null),
};

/** Mantener la pantalla encendida durante la partida: encendida por omisión. */
export const wakePref = {
  get: (): boolean => read('loveletter:wake') !== 'off',
  set: (on: boolean) => write('loveletter:wake', on ? null : 'off'),
};
