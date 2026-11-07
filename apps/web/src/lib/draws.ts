import type { CardValue, GameEvent } from '@loveletter/engine';

/** Una carta que viaja: del mazo a quien roba (`draw`) o de quien resuelve el Canciller al fondo del mazo (`return`). */
export interface DrawAnim {
  kind: 'draw' | 'return';
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
export const MAX_BATCH = 6;

/**
 * Decide qué robos animar a partir de los sucesos NUEVOS de la vista: el robo de inicio de turno,
 * el del Príncipe (no si salió de la carta apartada: el mazo estaba vacío) y las cartas del
 * Canciller. Nunca recibe el historial: el llamador solo pasa lo posterior a lo ya visto.
 */
export function drawAnimations(
  fresh: readonly GameEvent[],
  me: string,
  /** Lo que elegiste devolver al fondo con el Canciller, en `bottomOrder` (solo tú lo sabes). */
  myBottom?: readonly CardValue[] | null,
): DrawAnim[] {
  const out: Omit<DrawAnim, 'delay'>[][] = [];
  for (const e of fresh) {
    if (e.type === 'draw') {
      if (e.from === 'set_aside') continue;
      const mine = e.playerId === me;
      out.push([
        {
          kind: 'draw' as const,
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
          kind: 'draw' as const,
          key: `ev-${e.id}-${i}`,
          playerId: e.playerId,
          mine,
          ...(mine && e.secret?.drawn?.[i] !== undefined ? { card: e.secret.drawn[i] } : {}),
        })),
      );
    } else if (e.type === 'chancellor_done' && e.returned > 0) {
      // Las devueltas entran al fondo: la más profunda (la última de `bottomOrder`) llega primero y
      // la primera en robarse queda encima, así el orden elegido se lee en el vuelo.
      const mine = e.playerId === me;
      const faces = mine && myBottom && myBottom.length === e.returned ? myBottom : null;
      out.push(
        Array.from({ length: e.returned }, (_, k) => {
          const i = e.returned - 1 - k;
          return {
            kind: 'return' as const,
            key: `ev-${e.id}-r${i}`,
            playerId: e.playerId,
            mine,
            ...(faces ? { card: faces[i] } : {}),
          };
        }),
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
