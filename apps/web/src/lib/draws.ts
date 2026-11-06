import type { CardValue, GameEvent } from '@loveletter/engine';

/** Una carta que viaja del mazo a la mano o al asiento de quien roba. */
export interface DrawAnim {
  /** `ev-<id>` del suceso y posición dentro de él. */
  key: string;
  playerId: string;
  /** Eres tú: la carta crece, se voltea y enseña su cara (información privada tuya). */
  mine: boolean;
  /** Solo si `mine`: lo que robaste. */
  card?: CardValue;
  /** Segundos de retraso respecto al comienzo de la tanda. */
  delay: number;
}

/** Separación entre robos de sucesos distintos, y entre las dos cartas del Canciller. */
export const EVENT_GAP = 0.3;
export const CHANCELLOR_GAP = 0.12;
/** Si se acumulan más que esto, solo se animan las últimas. */
export const MAX_BATCH = 3;

/**
 * Decide qué robos animar a partir de los sucesos NUEVOS de la vista: el robo de inicio de turno,
 * el del Príncipe (no si salió de la carta apartada: el mazo estaba vacío) y las cartas del
 * Canciller. Nunca recibe el historial: el llamador solo pasa lo posterior a lo ya visto.
 */
export function drawAnimations(fresh: readonly GameEvent[], me: string): DrawAnim[] {
  const out: Omit<DrawAnim, 'delay'>[][] = [];
  for (const e of fresh) {
    if (e.type === 'draw') {
      if (e.from === 'set_aside') continue;
      const mine = e.playerId === me;
      out.push([
        {
          key: `ev-${e.id}-0`,
          playerId: e.playerId,
          mine,
          ...(mine && e.secret?.drawn?.[0] !== undefined ? { card: e.secret.drawn[0] } : {}),
        },
      ]);
    } else if (e.type === 'chancellor' && e.drawn > 0) {
      const mine = e.playerId === me;
      out.push(
        Array.from({ length: e.drawn }, (_, i) => ({
          key: `ev-${e.id}-${i}`,
          playerId: e.playerId,
          mine,
          ...(mine && e.secret?.drawn?.[i] !== undefined ? { card: e.secret.drawn[i] } : {}),
        })),
      );
    }
  }
  // Solo las últimas tandas: no se retrasa el juego animando lo viejo.
  const flat: DrawAnim[] = [];
  let at = 0;
  for (const group of out) {
    for (const [i, a] of group.entries()) flat.push({ ...a, delay: at + i * CHANCELLOR_GAP });
    at += (group.length - 1) * CHANCELLOR_GAP + EVENT_GAP;
  }
  const kept = flat.slice(-MAX_BATCH);
  const first = kept[0]?.delay ?? 0;
  return kept.map((a) => ({ ...a, delay: a.delay - first }));
}
