import { canVibrate, canWakeLock } from '../hooks/useDevice';
import type { NoticeMode } from '../lib/session';
import { Sheet } from './Sheet';

function Row({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="ll-menu-row"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
    >
      <span className="ll-menu-txt">
        <b className="ll-menu-t">{label}</b>
        <small className="ll-menu-s">{hint}</small>
      </span>
      <span className="ll-switch-pill" aria-hidden="true" />
    </button>
  );
}

/** Menú "Más" del móvil: lo secundario de la barra superior, en una hoja inferior. */
export function GameMenu({
  noticeMode,
  onNoticeMode,
  haptics,
  onHaptics,
  wake,
  onWake,
  onGuide,
  onLeave,
  onClose,
}: {
  noticeMode: NoticeMode;
  onNoticeMode: (mode: NoticeMode) => void;
  haptics: boolean;
  onHaptics: (on: boolean) => void;
  wake: boolean;
  onWake: (on: boolean) => void;
  onGuide: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet label="Más opciones" title="Más opciones" onClose={onClose}>
      <div className="ll-menu">
        <button type="button" className="ll-menu-row" onClick={onGuide}>
          <span className="ll-menu-txt">
            <b className="ll-menu-t">Carta guía</b>
            <small className="ll-menu-s">Las 10 cartas y qué hace cada una</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <Row
          label="Avisos de jugadas completos"
          hint={
            noticeMode === 'full'
              ? 'Ventana con la carta cada vez que otro juega'
              : 'Solo un aviso breve, salvo si te afecta'
          }
          checked={noticeMode === 'full'}
          onToggle={() => onNoticeMode(noticeMode === 'full' ? 'brief' : 'full')}
        />
        {canVibrate() && (
          <Row
            label="Vibrar en tu turno"
            hint="Una vibración corta cuando te toca jugar"
            checked={haptics}
            onToggle={() => onHaptics(!haptics)}
          />
        )}
        {canWakeLock() && (
          <Row
            label="Mantener la pantalla encendida"
            hint="Para que no se apague entre turnos"
            checked={wake}
            onToggle={() => onWake(!wake)}
          />
        )}
        <button type="button" className="ll-menu-row danger" onClick={onLeave}>
          <span className="ll-menu-txt">
            <b className="ll-menu-t">Salir de la partida</b>
            <small className="ll-menu-s">Vuelves al inicio</small>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
