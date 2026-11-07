import type { CardValue, PlayerView } from '@loveletter/engine';
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
export function useDraws(
  game: PlayerView,
  blocked = false,
  /** Lo que devolviste al fondo con el Canciller (para enseñar sus caras en el vuelo). */
  getBottom?: () => readonly CardValue[] | null,
) {
  const seen = useRef<number | null>(null);
  const endAt = useRef(0);
  const waiting = useRef<DrawAnim[]>([]);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const [tick, setTick] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});
  /** Cartas devueltas al fondo que aún vuelan: el contador del mazo no las cuenta hasta que llegan. */
  const [deckHold, setDeckHold] = useState(0);
  /** Cuenta las cartas que ya se metieron al fondo: la pila se asienta con cada una. */
  const [deckNudge, setDeckNudge] = useState(0);

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
      if (f.kind === 'return') {
        setDeckHold((n) => Math.max(0, n - 1));
        setDeckNudge((n) => n + 1);
      } else settle(f.playerId);
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
      setDeckHold(0);
      return;
    }
    const base = seen.current;
    const fresh = game.events.filter((e) => e.id > base);
    if (fresh.length === 0) return;
    seen.current = lastId;
    if (reducedMotion()) return;
    const anims = drawAnimations(fresh, game.you.id, getBottom?.());
    if (anims.length === 0) return;
    waiting.current.push(...anims);
    setPending((p) => {
      const next = { ...p };
      for (const a of anims) if (a.kind === 'draw') next[a.playerId] = (next[a.playerId] ?? 0) + 1;
      return next;
    });
    setDeckHold((n) => n + anims.filter((a) => a.kind === 'return').length);
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
      const drawsMine = anims.filter((a) => a.kind === 'draw' && a.mine).length;
      const taken = new Map<string, number>();
      const added: Flight[] = [];
      let mineIdx = 0;
      let returnIdx = 0;
      for (const a of anims) {
        if (a.kind === 'return') {
          // Del asiento (reversos) o de tu mano al fondo del mazo.
          let from: Rect | null;
          if (a.mine) {
            const base = toRect(handCards[0] ?? document.querySelector('.ll-hand'));
            from = base && { ...base, left: base.left + (returnIdx % 2 === 0 ? -14 : 14) };
          } else {
            const backs = document.querySelectorAll(
              `[data-seat-id="${a.playerId}"] .ll-backs .ll-back`,
            );
            from = toRect(
              backs[backs.length - 1] ?? document.querySelector(`[data-seat-id="${a.playerId}"]`),
            );
          }
          returnIdx += 1;
          if (!from || !deck) {
            setDeckHold((n) => Math.max(0, n - 1));
            continue;
          }
          added.push({
            id: a.key,
            kind: 'return',
            playerId: a.playerId,
            mine: a.mine,
            card: a.card,
            from,
            to: deck,
            delay: wait + a.delay,
          });
          continue;
        }
        let to: Rect | null;
        if (a.mine) {
          to = toRect(handCards[handCards.length - drawsMine + mineIdx]);
          mineIdx += 1;
        } else {
          const n = taken.get(a.playerId) ?? 0;
          taken.set(a.playerId, n + 1);
          const backs = document.querySelectorAll(
            `[data-seat-id="${a.playerId}"] .ll-backs .ll-back`,
          );
          const total = anims.filter(
            (x) => x.kind === 'draw' && x.playerId === a.playerId && !x.mine,
          ).length;
          to = toRect(backs[backs.length - total + n]);
        }
        if (!to || !deck) {
          // Sin hueco o sin mazo a la vista (p. ej. pantalla tapada): la carta aparece sin vuelo.
          settle(a.playerId);
          continue;
        }
        added.push({
          id: a.key,
          kind: 'draw',
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

  return {
    flights,
    pending,
    deckHold,
    deckNudge,
    land,
    active: Object.keys(pending).length > 0 || deckHold > 0,
  };
}
