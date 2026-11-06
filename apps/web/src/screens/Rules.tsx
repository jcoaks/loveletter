import { rules } from '@loveletter/engine';
import { Link } from 'react-router';
import { Card } from '../components/Card';
import { CARDS } from '../lib/cards';

/** /reglas — las reglas del juego, a partir de `config/loveletter-rules.json`. */
export default function RulesScreen() {
  const goals = Object.entries(rules.tokensToWin);
  return (
    <main className="mx-auto grid max-w-[1000px] gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="m-0 font-display text-3xl tracking-wider">Cómo se juega</h1>
          <img
            src="/assets/princess.webp"
            alt=""
            width={330}
            height={460}
            loading="lazy"
            decoding="async"
            className="hidden h-20 w-auto opacity-90 sm:block"
          />
        </div>
        <Link to="/" className="ll-ghost inline-grid place-items-center no-underline">
          Volver al inicio
        </Link>
      </header>
      <p className="m-0 text-lg text-ivory/90">
        {rules.edition}. De {rules.players.min} a {rules.players.max} jugadores. En tu turno robas
        una carta y juegas una de las dos que tienes. Hazle llegar tu carta a la Princesa: gana la
        ronda quien quede en pie o tenga la mano más alta, y la partida quien reúna antes las fichas
        de afecto necesarias.
      </p>

      <section aria-labelledby="r-prep" className="grid gap-2">
        <h2 id="r-prep" className="m-0 font-display text-2xl tracking-wider">
          Preparación
        </h2>
        <ul className="m-0 grid gap-1 pl-5">
          <li>Se baraja el mazo de {CARDS.reduce((n, c) => n + c.copies, 0)} cartas.</li>
          <li>Se aparta {rules.setup.removedFaceDown} carta boca abajo.</li>
          <li>
            Con 2 jugadores se apartan además {rules.setup.removedFaceUpTwoPlayers} cartas boca
            arriba.
          </li>
          <li>
            Cada jugador recibe {rules.setup.handSize} carta. Abre un jugador al azar; después,
            quien ganó la ronda anterior.
          </li>
        </ul>
      </section>

      <section aria-labelledby="r-fin" className="grid gap-2">
        <h2 id="r-fin" className="m-0 font-display text-2xl tracking-wider">
          Fin de ronda
        </h2>
        <ul className="m-0 grid gap-1 pl-5">
          {rules.roundEnd.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>{rules.spyBonus}</li>
        </ul>
      </section>

      <section aria-labelledby="r-fichas" className="grid gap-2">
        <h2 id="r-fichas" className="m-0 font-display text-2xl tracking-wider">
          Fichas de afecto para ganar
        </h2>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {goals.map(([n, t]) => (
            <li key={n} className="ll-chip">
              {n} jugadores: {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="r-cartas" className="grid gap-4">
        <h2 id="r-cartas" className="m-0 font-display text-2xl tracking-wider">
          Las 10 cartas
        </h2>
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {CARDS.map((c) => (
            <li key={c.value} className="flex items-start gap-4">
              <Card value={c.value} className="rules-card" />
              <div>
                <h3 className="m-0 font-display text-lg tracking-wider">
                  {c.value} · {c.name} <i className="ll-chip">×{c.copies}</i>
                </h3>
                <p className="m-0 mt-1">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
