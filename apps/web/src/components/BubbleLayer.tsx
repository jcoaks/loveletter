import { type CSSProperties, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const EDGE = 8;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Globos de los bots, en una capa propia pegada a `document.body` (posición fija) para que ningún
 * asiento, barra o panel los tape ni les herede opacidad o filtros. Cada globo se coloca con el
 * rectángulo de su asiento (`[data-seat-id]`): preferentemente justo debajo, o encima si abajo no
 * cabe y arriba no pisa la barra; siempre dentro de la pantalla y con la colita hacia el asiento.
 */
export function BubbleLayer({
  speech,
  names,
}: {
  /** Lo que dice cada bot ahora, por id de jugador. */
  speech: Record<string, string>;
  names: Record<string, string>;
}) {
  const refs = useRef(new Map<string, HTMLElement>());
  const ids = Object.keys(speech);
  const key = ids.join('|');

  const place = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const barBottom = document.querySelector('.ll-bar')?.getBoundingClientRect().bottom ?? 0;
    const actTop = document.querySelector('.ll-actbar')?.getBoundingClientRect().top ?? vh;
    for (const [id, el] of refs.current) {
      const seat = document.querySelector(`[data-seat-id="${id.replace(/"/g, '\\"')}"]`);
      if (!seat) {
        el.style.visibility = 'hidden';
        continue;
      }
      const r = seat.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const below = r.bottom + GAP;
      const above = r.top - GAP - h;
      const fitsBelow = below + h <= Math.min(actTop, vh) - 4;
      const fitsAbove = above >= barBottom + 4;
      const underneath = fitsBelow || !fitsAbove;
      const top = clamp(underneath ? below : above, EDGE, Math.max(EDGE, vh - h - EDGE));
      const left = clamp(r.left + r.width / 2 - w / 2, EDGE, Math.max(EDGE, vw - w - EDGE));
      const tail = clamp(r.left + r.width / 2 - left, 18, Math.max(18, w - 18));
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.setProperty('--tail-x', `${Math.round(tail)}px`);
      el.dataset.side = underneath ? 'below' : 'above';
      el.style.visibility = 'visible';
    }
  };

  // Primero se coloca de forma síncrona (sin parpadeo) y luego se sigue al asiento mientras dura.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` cambia cuando cambian los globos
  useLayoutEffect(() => {
    place();
  }, [key]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` cambia cuando cambian los globos
  useEffect(() => {
    if (ids.length === 0) return;
    let raf = 0;
    const loop = () => {
      place();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [key]);

  return createPortal(
    <div className="ll-bubbles" role="status" aria-live="polite">
      {ids.map((id) => (
        <div
          key={id}
          className="ll-bubble"
          style={{ visibility: 'hidden' } as CSSProperties}
          ref={(el) => {
            if (el) refs.current.set(id, el);
            else refs.current.delete(id);
          }}
        >
          <span className="sr-only-ll">{names[id] ?? 'Un bot'} dice: </span>
          {speech[id]}
        </div>
      ))}
    </div>,
    document.body,
  );
}
