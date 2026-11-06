import { useState } from 'react';
import { artUrl, CARD_BY_VALUE, type CardValue } from '../lib/cards';
import { CardIcon } from './icons';

export interface CardProps {
  value: CardValue;
  /** `lg`: mano y detalles. `sm`: descartes, mazo y apartada. */
  size?: 'lg' | 'sm';
  /** Si se define, la carta es un botón conmutable (`aria-pressed`). */
  selected?: boolean;
  /** Bloqueada por la Condesa: se ve pero no se puede jugar. */
  locked?: boolean;
  dimmed?: boolean;
  /** Si se define, la carta es un botón. */
  onClick?: () => void;
  disabled?: boolean;
  /** Reemplaza la etiqueta accesible por omisión. */
  ariaLabel?: string;
  /** Visible en el primer pantallazo (la mano): sin carga diferida. */
  eager?: boolean;
  className?: string;
}

/** Carta con arte (o diseño de respaldo si no hay imagen o falla la carga). */
export function Card({
  value,
  size = 'lg',
  selected,
  locked = false,
  dimmed = false,
  onClick,
  disabled,
  ariaLabel,
  eager = false,
  className = '',
}: CardProps) {
  const def = CARD_BY_VALUE[value];
  const [failed, setFailed] = useState(false);
  const src = artUrl(value, size);
  const art = Boolean(src) && !failed;
  const sm = size === 'sm';
  const cls = [
    'll-card',
    sm && 'sm',
    art && 'has-art',
    selected && 'on',
    locked && 'lock',
    dimmed && 'dim',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const label =
    ariaLabel ??
    (sm
      ? def.name
      : `${value}, ${def.name}. ${def.short}${locked ? ' Bloqueada por la Condesa.' : ''}`);

  const inner = (
    <>
      {art && (
        <img
          className="art"
          src={src}
          alt=""
          width={sm ? 114 : 378}
          height={sm ? 160 : 529}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <span className="val" aria-hidden="true">
        {value}
      </span>
      <span className="ico" aria-hidden="true">
        <CardIcon value={value} />
      </span>
      <span className="nm" aria-hidden="true">
        {def.name}
      </span>
      <span className="fx" aria-hidden="true">
        {def.short}
      </span>
      {locked && (
        <span className="lk" aria-hidden="true">
          Bloqueada por la Condesa
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected === undefined ? undefined : selected}
        aria-label={label}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} role="img" aria-label={label}>
      {inner}
    </span>
  );
}

/** Reverso de carta (tamaño pequeño). */
export function CardBack({ className = '' }: { className?: string }) {
  return <span className={`ll-back ${className}`} aria-hidden="true" />;
}

/** Hilera superpuesta de cartas pequeñas. */
export function CardFan({
  cards,
  className = '',
}: {
  cards: readonly CardValue[];
  className?: string;
}) {
  return (
    <span className={`ll-fan ${className}`}>
      {cards.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: los descartes son una lista ordenada que solo crece
        <Card key={`${i}-${v}`} value={v} size="sm" />
      ))}
    </span>
  );
}
