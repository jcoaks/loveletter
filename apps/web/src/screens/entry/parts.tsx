import type { RoomInfo } from '@loveletter/protocol';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { getRoomInfo } from '../../lib/api';
import { LOGO_ART } from '../../lib/cards';
import { type JoinProblem, problemCopy, requestProblem } from './joinProblems';

export type RoomInfoState =
  | { state: 'loading' }
  | { state: 'ready'; info: RoomInfo }
  | { state: 'error'; problem: JoinProblem };

export function useRoomInfo(code: string | null) {
  const [result, setResult] = useState<RoomInfoState>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` repite la petición
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setResult({ state: 'loading' });
    getRoomInfo(code).then(
      (info) => !cancelled && setResult({ state: 'ready', info }),
      (error: unknown) =>
        !cancelled && setResult({ state: 'error', problem: requestProblem(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { result, reload };
}

export function ProblemAlert({ problem, id }: { problem: JoinProblem; id?: string }) {
  const copy = problemCopy(problem);
  return (
    <div id={id} role="alert" className="rounded-xl border border-wax bg-black/30 p-4">
      <b className="text-[#ff9fae]">{copy.title}</b>
      <p className="m-0 mt-1 text-ivory/85">{copy.message}</p>
    </div>
  );
}

export function Logo({ width = 300, eager = true }: { width?: number; eager?: boolean }) {
  return (
    <img
      src={LOGO_ART}
      alt="Love Letter"
      width={547}
      height={190}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ width: `min(${width}px, 80vw)`, height: 'auto' }}
    />
  );
}

/** Marco de las pantallas de entrada: fondo con el arte de grupo (se carga sin bloquear el formulario). */
export function EntryShell({ children, hero = false }: { children: ReactNode; hero?: boolean }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-6 overflow-x-hidden px-4 py-10">
      {hero && (
        <>
          <picture className="absolute inset-0 -z-20">
            <source media="(max-width: 640px)" srcSet="/assets/hero-group-m.webp" />
            <img
              src="/assets/hero-group.webp"
              alt=""
              width={1200}
              height={667}
              decoding="async"
              fetchPriority="low"
              className="size-full object-cover object-top opacity-60"
            />
          </picture>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-b from-wine/70 via-wine/80 to-wine"
          />
        </>
      )}
      {children}
    </main>
  );
}
