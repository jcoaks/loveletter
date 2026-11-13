import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CardValue } from '../lib/cards';
import { Card } from './Card';
import type { Rect } from './DrawLayer';

/** Segundos que tarda una carta jugada en llegar al aviso. */
export const PLAY_FLIGHT_SECONDS = 0.65;
const BACK = 'url(/assets/card-back.webp) center / 100% 100% no-repeat, #5a1d38';

/**
 * Una carta jugada que sale de la mano (o del asiento de un rival) y llega a `to`: por encima de
 * las ventanas, para que se vea cruzar el tablero. Desde un asiento sale de espaldas y se voltea
 * en el camino; desde tu mano ya sale de cara. Con `fade` se apaga al llegar (cuando no hay un
 * hueco donde aterrizar).
 */
export function CardFlyer({
  card,
  from,
  to,
  fromBack,
  fade = false,
  delay = 0,
  onLand,
}: {
  card: CardValue;
  from: Rect;
  to: Rect;
  fromBack: boolean;
  fade?: boolean;
  /** Segundos de espera antes de salir (la carta espera quieta, invisible). */
  delay?: number;
  onLand: () => void;
}) {
  const d = PLAY_FLIGHT_SECONDS;
  const scale0 = Math.max(0.2, from.width / to.width);
  const style = {
    width: to.width,
    height: to.height,
    '--card-w-lg': `${to.width}px`,
    transformOrigin: '0 0',
    transformPerspective: 900,
  } as CSSProperties;
  const ease = (curve: [number, number, number, number]) => ({
    duration: d,
    delay,
    ease: curve,
  });
  return createPortal(
    <div className="ll-flights top" aria-hidden="true">
      <motion.div
        className="ll-flyer"
        style={style}
        initial={{
          x: from.left,
          y: from.top,
          scale: scale0,
          rotate: fromBack ? -12 : 6,
          opacity: delay > 0 ? 0 : 1,
        }}
        animate={{
          x: to.left,
          y: to.top,
          scale: 1,
          rotate: 0,
          opacity: fade ? [1, 1, 0] : 1,
        }}
        transition={{
          x: ease([0.22, 1, 0.36, 1]),
          y: ease([0.45, 0, 0.2, 1]),
          scale: ease([0.22, 1, 0.36, 1]),
          rotate: ease([0.22, 1, 0.36, 1]),
          opacity: fade
            ? { duration: d + 0.25, delay, times: [0, 0.75, 1], ease: 'linear' }
            : { duration: 0.01, delay },
        }}
        onAnimationComplete={onLand}
      >
        {fromBack ? (
          <motion.div
            className="ll-flyer-flip"
            initial={{ rotateY: 180 }}
            animate={{ rotateY: 0 }}
            transition={{ duration: d * 0.5, delay: delay + d * 0.3, ease: 'easeOut' }}
          >
            <span className="ll-flyer-back" style={{ background: BACK }} />
            <span className="ll-flyer-face">
              <Card value={card} ariaLabel="" />
            </span>
          </motion.div>
        ) : (
          <Card value={card} ariaLabel="" />
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
