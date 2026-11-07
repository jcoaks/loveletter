import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CardValue } from '../lib/cards';
import { Card } from './Card';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Una carta en vuelo: del mazo (`from`) al hueco real de destino (`to`). */
export interface Flight {
  id: string;
  /** `draw`: del mazo al hueco de quien roba. `return`: de quien resuelve el Canciller al fondo del mazo. */
  kind?: 'draw' | 'return';
  playerId: string;
  /** Tú robas: vuela a tu mano, crece y se voltea para enseñar su cara. */
  mine: boolean;
  card?: CardValue;
  from: Rect;
  to: Rect;
  /** Segundos de espera antes de salir. */
  delay: number;
  /** Segundos de vuelo (por omisión 0,6). */
  duration?: number;
}

export const FLIGHT_SECONDS = 0.6;
/** Cuánto asoma (px) por debajo de la pila, hacia abajo y a la derecha, la carta que se mete al fondo. */
const UNDER_OFFSET = 10;

/** Recorta todo menos el rectángulo de la pila: la carta queda tapada por ella, como si entrara por debajo. */
const underStack = (r: Rect): string =>
  `polygon(evenodd, 0px 0px, 100vw 0px, 100vw 100vh, 0px 100vh, 0px 0px, ${r.left}px ${r.top}px, ${r.left}px ${r.top + r.height}px, ${r.left + r.width}px ${r.top + r.height}px, ${r.left + r.width}px ${r.top}px, ${r.left}px ${r.top}px)`;
const BACK = 'url(/assets/card-back.webp) center / 100% 100% no-repeat, #5a1d38';

/** Vuelo de regreso al mazo: la carta (cara si es tuya) encoge, gira a reverso y se cuela bajo la pila. */
function ReturnView({ flight, onLand }: { flight: Flight; onLand: (f: Flight) => void }) {
  const { from, to, delay, mine, card } = flight;
  const d = flight.duration ?? FLIGHT_SECONDS;
  const style = {
    width: from.width,
    height: from.height,
    '--card-w-lg': `${from.width}px`,
    transformOrigin: '0 0',
    transformPerspective: 900,
  } as CSSProperties;
  // Termina en la esquina inferior derecha de la pila, asomando un poco, y queda tapada por ella.
  const end = Math.max(0.2, (to.width - 6) / from.width);
  const arc = (ease: [number, number, number, number]) => ({ duration: d, delay, ease });
  return (
    <motion.div
      className="ll-flyer"
      style={style}
      initial={{ x: from.left, y: from.top, scale: 1, rotate: 5, opacity: 0 }}
      animate={{
        x: to.left + UNDER_OFFSET,
        y: to.top + UNDER_OFFSET,
        scale: end,
        rotate: -4,
        // Sin fundido sobre la pila: lo que se ve de la carta es lo que la pila no tapa; solo la
        // rendija que asoma se apaga en el último instante, al sustituirla la pila real.
        opacity: [1, 1, 0],
      }}
      transition={{
        x: arc([0.45, 0, 0.2, 1]),
        y: arc([0.22, 1, 0.36, 1]),
        scale: arc([0.45, 0, 0.2, 1]),
        rotate: arc([0.22, 1, 0.36, 1]),
        opacity: { duration: d, delay, times: [0, 0.94, 1], ease: 'linear' },
      }}
      onAnimationComplete={() => onLand(flight)}
    >
      {mine && card !== undefined ? (
        <motion.div
          className="ll-flyer-flip"
          initial={{ rotateY: 0 }}
          animate={{ rotateY: 180 }}
          transition={{ duration: d * 0.45, delay: delay + d * 0.2, ease: 'easeInOut' }}
        >
          <span className="ll-flyer-back" style={{ background: BACK }} />
          <span className="ll-flyer-face">
            <Card value={card} ariaLabel="" />
          </span>
        </motion.div>
      ) : (
        <span className="ll-flyer-back plain" style={{ background: BACK }} />
      )}
    </motion.div>
  );
}

function FlightView({ flight, onLand }: { flight: Flight; onLand: (f: Flight) => void }) {
  const { from, to, delay, mine, card } = flight;
  const d = flight.duration ?? FLIGHT_SECONDS;
  const scale0 = Math.max(0.2, from.width / to.width);
  const style = {
    width: to.width,
    height: to.height,
    '--card-w-lg': `${to.width}px`,
    transformOrigin: '0 0',
    transformPerspective: 900,
  } as CSSProperties;
  const arc = (ease: [number, number, number, number]) => ({ duration: d, delay, ease });
  return (
    <motion.div
      className="ll-flyer"
      style={style}
      initial={{ x: from.left, y: from.top, scale: scale0, rotate: -14, opacity: 0 }}
      animate={{ x: to.left, y: to.top, scale: 1, rotate: 0, opacity: 1 }}
      transition={{
        x: arc([0.22, 1, 0.36, 1]),
        y: arc([0.45, 0, 0.2, 1]),
        scale: arc([0.22, 1, 0.36, 1]),
        rotate: arc([0.22, 1, 0.36, 1]),
        opacity: { duration: 0.01, delay },
      }}
      onAnimationComplete={() => onLand(flight)}
    >
      {mine && card !== undefined ? (
        <motion.div
          className="ll-flyer-flip"
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{ duration: d * 0.5, delay: delay + d * 0.45, ease: 'easeOut' }}
        >
          <span className="ll-flyer-back" style={{ background: BACK }} />
          <span className="ll-flyer-face">
            <Card value={card} ariaLabel="" />
          </span>
        </motion.div>
      ) : (
        <span className="ll-flyer-back plain" style={{ background: BACK }} />
      )}
    </motion.div>
  );
}

/**
 * Capa de animación de los robos: portal a `document.body`, fija, sin clics, por encima del tablero
 * y por debajo de las ventanas. Cada carta sale del mazo y aterriza exactamente en su hueco real.
 */
export function DrawLayer({
  flights,
  onLand,
}: {
  flights: readonly Flight[];
  onLand: (f: Flight) => void;
}) {
  return createPortal(
    <div className="ll-flights" aria-hidden="true">
      {flights.map((f) =>
        f.kind === 'return' ? (
          // Las devueltas entran por debajo de la pila (la pila las tapa); los robos salen por encima.
          <div key={f.id} className="ll-flight-clip" style={{ clipPath: underStack(f.to) }}>
            <ReturnView flight={f} onLand={onLand} />
          </div>
        ) : (
          <FlightView key={f.id} flight={f} onLand={onLand} />
        ),
      )}
    </div>,
    document.body,
  );
}
