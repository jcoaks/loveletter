import type { PlayerView } from '@loveletter/engine';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Flight, Rect } from '../components/DrawLayer';
import { FLIGHT_SECONDS } from '../components/DrawLayer';
import { type DrawAnim, drawAnimations } from '../lib/draws';

const toRect = (el: Element | undefined | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Lanza los vuelos de cartas del mazo a quien roba, solo para sucesos nuevos desde que se abrió la
 * pantalla. Mientras una carta vuela, su hueco real sigue oculto (`pending`, por jugador) y se
 * muestra al aterrizar. Con movimiento reducido no hay vuelo: la carta aparece sin más.
 */
export function useDraws(game: PlayerView, blocked = false) {
  const seen = useRef<number | null>(null);
  const endAt = useRef(0);
  const waiting = useRef<DrawAnim[]>([]);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const [tick, setTick] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});

  const settle = useCallback((playerId: string) => {
    setPending((p) => {
      const n = (p[playerId] ?? 0) - 1;
      const next = { ...p };
      if (n > 0) next[playerId] = n;
      else delete next[playerId];
      return next;
    });
  }, []);

  const land = useCallback(
    (f: Flight) => {
      let removed = false;
      setFlights((list) => {
        removed = list.some((x) => x.id === f.id);
        return removed ? list.filter((x) => x.id !== f.id) : list;
      });
      // Solo se descuenta una vez por vuelo (puede aterrizar por la animación o por el temporizador).
      if (landed.current.has(f.id)) return;
      landed.current.add(f.id);
      settle(f.playerId);
    },
    [settle],
  );
  const landed = useRef(new Set<string>());

  // Sucesos nuevos: se reserva ya el hueco (oculto) y se encolan los vuelos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo importan los sucesos nuevos
  useLayoutEffect(() => {
    const lastId = game.events.at(-1)?.id ?? -1;
    if (seen.current === null || lastId < seen.current) {
      seen.current = lastId;
      waiting.current = [];
      setFlights([]);
      setPending({});
      return;
    }
    const base = seen.current;
    const fresh = game.events.filter((e) => e.id > base);
    if (fresh.length === 0) return;
    seen.current = lastId;
    if (reducedMotion()) return;
    const anims = drawAnimations(fresh, game.you.id);
    if (anims.length === 0) return;
    waiting.current.push(...anims);
    setPending((p) => {
      const next = { ...p };
      for (const a of anims) next[a.playerId] = (next[a.playerId] ?? 0) + 1;
      return next;
    });
    setTick((t) => t + 1);
  }, [game.events]);

  // Salen cuando no hay una ventana encima (si no, volarían por debajo y no se verían).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` y `blocked` disparan el lanzamiento
  useEffect(() => {
    if (blocked || waiting.current.length === 0) return;
    const timer = window.setTimeout(() => {
      if (blockedRef.current) return;
      const anims = waiting.current.splice(0);
      const deck = toRect(document.querySelector('.ll-stack'));
      const now = performance.now();
      const wait = Math.max(0, endAt.current - now) / 1000;
      const handCards = Array.from(document.querySelectorAll('.ll-hand .ll-card'));
      const mineCount = anims.filter((a) => a.mine).length;
      const taken = new Map<string, number>();
      const added: Flight[] = [];
      let mineIdx = 0;
      for (const a of anims) {
        let to: Rect | null;
        if (a.mine) {
          to = toRect(handCards[handCards.length - mineCount + mineIdx]);
          mineIdx += 1;
        } else {
          const n = taken.get(a.playerId) ?? 0;
          taken.set(a.playerId, n + 1);
          const backs = document.querySelectorAll(
            `[data-seat-id="${a.playerId}"] .ll-backs .ll-back`,
          );
          const total = anims.filter((x) => x.playerId === a.playerId && !x.mine).length;
          to = toRect(backs[backs.length - total + n]);
        }
        if (!to || !deck) {
          // Sin hueco o sin mazo a la vista (p. ej. pantalla tapada): la carta aparece sin vuelo.
          settle(a.playerId);
          continue;
        }
        added.push({
          id: a.key,
          playerId: a.playerId,
          mine: a.mine,
          card: a.card,
          from: deck,
          to,
          delay: wait + a.delay,
        });
      }
      if (added.length === 0) return;
      endAt.current = now + (Math.max(...added.map((f) => f.delay)) + FLIGHT_SECONDS) * 1000;
      setFlights((list) => [...list, ...added]);
      // Red de seguridad: si una animación no avisa, la carta real se muestra igualmente.
      for (const f of added) {
        window.setTimeout(() => land(f), (f.delay + FLIGHT_SECONDS + 0.6) * 1000);
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [tick, blocked]);

  return { flights, pending, land, active: Object.keys(pending).length > 0 };
}
