import { useState } from 'react';
import { TOKEN_ART } from '../lib/cards';
import { HeartIcon } from './icons';

/** Ficha de afecto, llena o vacía. Cae a un corazón si la imagen no carga. */
export function Token({ filled = false }: { filled?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <HeartIcon filled={filled} />;
  return (
    <img
      className={`ll-tok${filled ? ' f' : ''}`}
      src={TOKEN_ART}
      alt=""
      width={72}
      height={72}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** Fichas de un jugador: `count` llenas de `total`, con texto para lectores de pantalla. */
export function Tokens({ count, total }: { count: number; total: number }) {
  return (
    <span className="ll-tokens">
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas
        <Token key={i} filled={i < count} />
      ))}
      <span className="sr-only-ll">
        {count} de {total} fichas
      </span>
    </span>
  );
}
