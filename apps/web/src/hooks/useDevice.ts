import { useEffect, useState } from 'react';

/** ¿El navegador sabe vibrar? (Android sí; iOS Safari no.) */
export const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** ¿El navegador permite mantener la pantalla encendida? */
export const canWakeLock = (): boolean =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/**
 * Mantiene la pantalla encendida mientras `enabled`. Se degrada sin ruido: si el navegador no lo
 * admite o lo rechaza (batería baja, pestaña oculta) simplemente no hace nada; al volver a la
 * pestaña lo pide de nuevo.
 */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled || !canWakeLock()) {
      setActive(false);
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void next.release().catch(() => undefined);
          return;
        }
        lock = next;
        setActive(true);
        next.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [enabled]);
  return active;
}

/** Vibración breve cuando pasa a ser tu turno (si está activada y el dispositivo puede). */
export function useTurnVibration(myTurn: boolean, enabled: boolean): void {
  useEffect(() => {
    if (myTurn && enabled && canVibrate()) navigator.vibrate([70, 50, 70]);
  }, [myTurn, enabled]);
}
