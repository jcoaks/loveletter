import { useId } from 'react';

/** Registro de jugadas, la más reciente primero. */
export function LogPanel({ entries }: { entries: readonly string[] }) {
  const id = useId();
  return (
    <>
      <h4 className="ll-lbl ll-logh" id={id}>
        Registro de jugadas
      </h4>
      <ol className="ll-log" aria-labelledby={id}>
        {entries.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el registro puede repetir líneas
          <li key={`${i}-${t}`}>{t}</li>
        ))}
      </ol>
    </>
  );
}
