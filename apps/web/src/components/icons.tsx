import type { CardValue } from '../lib/cards';

const GLYPHS: Record<CardValue, string> = {
  0: 'M3 9c3-2 6-2 9 0 3-2 6-2 9 0v3c0 3-3 4-5 3l-4-2-4 2c-2 1-5 0-5-3z',
  1: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  2: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
  3: 'M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z',
  4: 'M8 11h8a2 2 0 012 2v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5a2 2 0 012-2z M8 11V8a4 4 0 018 0v3',
  5: 'M20 12a8 8 0 11-3-6.2M20 4v4h-4',
  6: 'M7 3h10v14a3 3 0 003 3H8a3 3 0 01-3-3V6a3 3 0 012-3zM9 8h6M9 12h6',
  7: 'M3 18l1.5-10 5 5L12 5l2.5 8 5-5L21 18zM4 21h16',
  8: 'M6 4h12l4 6-10 11L2 10zM2 10h20',
  9: 'M12 21s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 10c0 6-8 11-8 11z',
};

/** Glifo decorativo de cada carta (se usa como respaldo cuando no hay arte). */
export function CardIcon({ value, className }: { value: CardValue; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={GLYPHS[value]} />
    </svg>
  );
}

export const HeartIcon = ({ filled, className }: { filled?: boolean; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`ll-heart${filled ? ' f' : ''} ${className ?? ''}`}
  >
    <path d={GLYPHS[9]} />
  </svg>
);

function ToolSvg({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/** Íconos de la barra superior (libro, pergamino, tres puntos). */
export const BookIcon = ({ className }: { className?: string }) => (
  <ToolSvg
    className={className}
    d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13M9 7h6"
  />
);
export const ScrollIcon = ({ className }: { className?: string }) => (
  <ToolSvg
    className={className}
    d="M7 3h10v14a3 3 0 003 3H8a3 3 0 01-3-3V6a3 3 0 012-3zM9 8h6M9 12h6"
  />
);
export const MoreIcon = ({ className }: { className?: string }) => (
  <ToolSvg className={className} d="M5 12h.01M12 12h.01M19 12h.01" />
);
