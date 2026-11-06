import { useState } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { CARDS, type CardValue } from '../../lib/cards';

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="lh-glyph"
    >
      <path d={d} />
    </svg>
  );
}

const STEPS = [
  {
    title: 'Crea la sala',
    text: 'Elige un nombre y listo: tú eres el anfitrión de la mesa.',
    glyph: 'M7 3h10v18H7zM12 9v6M9 12h6',
  },
  {
    title: 'Comparte el enlace',
    text: 'Mándales el enlace o el código de seis letras. Sin cuentas, sin instalar nada.',
    glyph:
      'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  },
  {
    title: 'Completa con bots',
    text: '¿Faltan jugadores? Añade bots: juegan solos y hasta comentan sus jugadas.',
    glyph:
      'M12 3v3M7 7h10a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6a3 3 0 013-3zM9 12h.01M15 12h.01M9 16h6',
  },
  {
    title: 'Juega y gana fichas',
    text: 'Termina la ronda con la carta más alta o deja a los demás fuera. Las fichas de afecto deciden quién conquista a la Princesa.',
    glyph: null,
  },
] as const;

/** "Cómo se juega en 30 segundos": cuatro pasos con sellos de cera numerados. */
export function HowTo() {
  return (
    <section id="como" className="lh-sec" aria-labelledby="h-como">
      <h2 id="h-como" className="lh-h2">
        Cómo se juega en 30 segundos
      </h2>
      <ol className="lh-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="lh-step" style={{ '--i': i } as React.CSSProperties}>
            <span className="lh-wax" aria-hidden="true">
              {i + 1}
            </span>
            <span className="lh-step-ico" aria-hidden="true">
              {s.glyph ? (
                <Glyph d={s.glyph} />
              ) : (
                <img src="/assets/token.webp" alt="" width={72} height={72} loading="lazy" />
              )}
            </span>
            <h3 className="lh-h3">{s.title}</h3>
            <p className="lh-p">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Las diez cartas: carrusel en el móvil y rejilla con ligera inclinación en pantallas anchas. */
export function CardShowcase() {
  const [open, setOpen] = useState<CardValue | null>(null);
  const current = open === null ? null : CARDS.find((c) => c.value === open);
  const move = (d: number) =>
    setOpen(
      (v) =>
        (v === null ? v : (((v + d) % CARDS.length) + CARDS.length) % CARDS.length) as CardValue,
    );
  return (
    <section id="cartas" className="lh-sec" aria-labelledby="h-cartas">
      <h2 id="h-cartas" className="lh-h2">
        Diez cartas, diez maneras de intrigar
      </h2>
      <p className="lh-lead">Toca una carta para verla grande y leer qué hace.</p>
      <ul className="lh-cards">
        {CARDS.map((c, i) => (
          <li key={c.value} style={{ '--i': i } as React.CSSProperties}>
            <button
              type="button"
              className="lh-cardbtn"
              aria-label={`${c.value}, ${c.name}: ${c.short} Ver grande`}
              onClick={() => setOpen(c.value)}
            >
              <Card value={c.value} ariaLabel="" />
              <span className="lh-cap">
                <b className="lh-cap-n">{c.name}</b>
                <i>×{c.copies}</i>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <Sheet
          label={`${current.name}, valor ${current.value}`}
          title={`${current.value} · ${current.name}`}
          sub={`En el mazo hay ${current.copies} ${current.copies === 1 ? 'copia' : 'copias'}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <button type="button" className="ll-ghost" onClick={() => move(-1)}>
                ‹ Anterior
              </button>
              <button type="button" className="ll-ghost" onClick={() => move(1)}>
                Siguiente ›
              </button>
            </>
          }
        >
          <div className="lh-zoom">
            <Card value={current.value} ariaLabel={`${current.name}: ${current.short}`} eager />
            <p className="ll-rtxt" style={{ textAlign: 'left' }}>
              {current.text}
            </p>
          </div>
        </Sheet>
      )}
    </section>
  );
}

const FEATURES = [
  {
    title: '2 a 6 jugadores',
    text: 'Del duelo a dos a una mesa llena de intrigas.',
    glyph:
      'M16 20v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 11a3 3 0 100-6 3 3 0 000 6M20 20v-1a3 3 0 00-2-2.8M16 5.2a3 3 0 010 5.6',
  },
  {
    title: 'Bots que hablan',
    text: 'Completan la mesa y comentan lo que pasa.',
    glyph: 'M4 5h16v11H9l-5 4z',
  },
  {
    title: 'Sin cuentas',
    text: 'Entras con un nombre. Tu asiento se recuerda en este navegador.',
    glyph: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  },
  {
    title: 'Hecho para el móvil',
    text: 'Toda la mesa cabe en la pantalla y se juega con el pulgar.',
    glyph: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  },
  {
    title: 'Partidas rápidas',
    text: 'Rondas de pocos minutos: una más, y otra más.',
    glyph: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18',
  },
  {
    title: 'Reconexión',
    text: 'Si se cae tu conexión, vuelves a tu asiento y la partida espera.',
    glyph: 'M20 12a8 8 0 11-3-6.2M20 4v4h-4',
  },
] as const;

export function Features() {
  return (
    <section className="lh-sec" aria-labelledby="h-feat">
      <h2 id="h-feat" className="lh-h2">
        Todo lo que necesitas para jugar
      </h2>
      <ul className="lh-feats">
        {FEATURES.map((f) => (
          <li key={f.title} className="lh-feat">
            <span className="lh-feat-ico">
              <Glyph d={f.glyph} />
            </span>
            <h3 className="lh-h3">{f.title}</h3>
            <p className="lh-p">{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className="lh-foot">
      <img src="/assets/seal.webp" alt="" width={56} height={56} loading="lazy" decoding="async" />
      <p className="lh-foot-cta">
        <Link to="/reglas" className="ll-link">
          Leer las reglas completas
        </Link>
      </p>
      <p className="lh-fine">
        Love Letter es un juego de Seiji Kanai, publicado por AEG y Z-Man Games. Este es un proyecto
        de fans, sin fines comerciales ni relación con sus autores o editores.
      </p>
    </footer>
  );
}
