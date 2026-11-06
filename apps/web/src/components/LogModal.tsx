import { Sheet } from './Sheet';

/** Crónica completa de la partida, la más reciente primero. */
export function LogModal({
  entries,
  onClose,
}: {
  entries: readonly string[];
  onClose: () => void;
}) {
  return (
    <Sheet
      label="Registro de jugadas"
      title="Registro de jugadas"
      sub="La más reciente primero"
      onClose={onClose}
    >
      <ol className="ll-log" style={{ borderTop: 0 }} aria-label="Registro de jugadas">
        {entries.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el registro puede repetir líneas
          <li key={`${i}-${t}`}>{t}</li>
        ))}
      </ol>
    </Sheet>
  );
}
