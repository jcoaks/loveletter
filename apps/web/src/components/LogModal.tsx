import type { LogLine } from '../lib/chronicle';
import { Sheet } from './Sheet';

/** Crónica completa de la partida, la más reciente primero. */
export function LogModal({
  entries,
  onClose,
}: {
  entries: readonly LogLine[];
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
        {entries.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: el registro puede repetir líneas
          <li key={`${i}-${l.text}`}>
            {l.text}
            {l.secret && (
              <i className="ll-chip" style={{ marginLeft: 8, fontSize: 10 }}>
                solo tú
              </i>
            )}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
