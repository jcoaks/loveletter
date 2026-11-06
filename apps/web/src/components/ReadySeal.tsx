import { useEffect, useRef, useState } from 'react';

/**
 * Sello rojo de cera de "listo". Ocupa siempre su sitio (no mueve el cuadro al aparecer). Se estampa
 * con una animación solo cuando el estado cambia después de montarse; los que ya estaban listos al
 * llegar, y los bots (`fixed`), lo muestran fijo. Es decorativo: el texto "Listo" lo da quien lo usa.
 */
export function ReadySeal({ ready, fixed = false }: { ready: boolean; fixed?: boolean }) {
  const was = useRef(ready);
  const [phase, setPhase] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    if (fixed || ready === was.current) return;
    was.current = ready;
    setPhase(ready ? 'in' : 'out');
    if (ready) return;
    const timer = window.setTimeout(() => setPhase(null), 260);
    return () => window.clearTimeout(timer);
  }, [ready, fixed]);

  const show = ready || phase === 'out';
  return (
    <span className="ll-seal-slot" aria-hidden="true">
      {show && (
        <img
          className={`ll-seal${phase === 'in' ? ' stamp' : ''}${phase === 'out' && !ready ? ' fade' : ''}`}
          src="/assets/seal.webp"
          alt=""
          width={112}
          height={112}
          decoding="async"
        />
      )}
    </span>
  );
}
