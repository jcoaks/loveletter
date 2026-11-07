import { Link } from 'react-router';
import { LogoLockup } from '../components/LogoLockup';
import { RulesContent } from '../components/RulesContent';

/** /reglas — las reglas del juego, a partir de `config/loveletter-rules.json`. */
export default function RulesScreen() {
  return (
    <main className="mx-auto grid max-w-[1000px] gap-8 px-4 py-8">
      <header className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <LogoLockup height={36} />
          <Link to="/" className="ll-ghost">
            Volver al inicio
          </Link>
        </div>
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
      </header>
      <RulesContent />
    </main>
  );
}
