import { type RefObject, useEffect, useRef, useState } from 'react';

const TICK_MS = 100;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Cuenta atrás de un aviso que se cierra solo. Se detiene mientras el cursor está sobre él o el
 * foco está en cualquiera de sus elementos (salvo la propia ventana al abrirse), para poder leerlo
 * con calma o con teclado. `root` es cualquier elemento dentro de la ventana.
 */
export function useCountdown({
  ms,
  resetKey,
  onDone,
  root,
}: {
  ms: number;
  resetKey: string;
  onDone: () => void;
  root: RefObject<HTMLElement | null>;
}) {
  const [elapsed, setElapsed] = useState(0);
  const hover = useRef(false);
  const done = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;

  const sheet = () => root.current?.closest<HTMLElement>('.ll-sheet') ?? null;
  const focusInside = () => {
    const el = sheet();
    const active = document.activeElement;
    return Boolean(el && active && active !== el && el.contains(active));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: un aviso nuevo reinicia la cuenta
  useEffect(() => {
    done.current = false;
    setElapsed(0);
    const timer = window.setInterval(() => {
      if (hover.current || focusInside()) return;
      setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [resetKey, ms]);

  // Al llegar a cero se cierra una sola vez.
  useEffect(() => {
    if (elapsed >= ms && !done.current) {
      done.current = true;
      finish.current();
    }
  }, [elapsed, ms]);

  return {
    elapsed,
    secondsLeft: Math.max(0, Math.ceil((ms - elapsed) / 1000)),
    pointer: {
      onMouseEnter: () => {
        hover.current = true;
      },
      onMouseLeave: () => {
        hover.current = false;
      },
    },
  };
}
