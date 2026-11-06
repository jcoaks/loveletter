import type { PlayerView } from '@loveletter/engine';
import { tableMoment } from '@loveletter/protocol';
import { useEffect, useRef } from 'react';
import { useRoomStore } from '../store/room';

/** Pausa mínima tras cerrarse el último aviso o frase, antes de dar el suceso por visto. */
const SETTLE_MS = 200;

/**
 * Avisa a la sala cuando esta pantalla terminó de mostrar lo ocurrido (resultados, frases de bots)
 * para que los bots esperen a la mesa antes de jugar. Usa exactamente `tableMoment(game)`.
 * Nunca bloquea la entrada del jugador.
 */
export function useTableReady(game: PlayerView | null, busy: boolean): void {
  const status = useRoomStore((s) => s.status);
  const send = useRoomStore((s) => s.send);
  const sent = useRef<string | null>(null);
  const moment = game ? tableMoment(game) : null;

  // Una conexión nueva empieza de cero: la sala puede seguir esperando a este asiento.
  useEffect(() => {
    if (status !== 'open') sent.current = null;
  }, [status]);

  useEffect(() => {
    if (!moment || busy || status !== 'open' || sent.current === moment) return;
    const timer = window.setTimeout(() => {
      sent.current = moment;
      send({ type: 'table_ready', moment });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [moment, busy, status, send]);
}
