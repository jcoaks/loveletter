import { LOGO_ART } from '../lib/cards';

/** Portada provisional hasta que existan las pantallas conectadas al protocolo. */
export function Placeholder() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid justify-items-center gap-4">
        <img
          src={LOGO_ART}
          alt="Love Letter"
          width={547}
          height={190}
          className="h-auto w-[min(368px,80vw)]"
        />
        <p className="m-0 text-lg text-ivory/80">Hazle llegar tu carta a la Princesa.</p>
        {import.meta.env.DEV && (
          <a className="ll-ghost" href="/dev/gallery">
            Galería de componentes
          </a>
        )}
      </div>
    </main>
  );
}
