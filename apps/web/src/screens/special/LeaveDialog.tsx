import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useRoomStore } from '../../store/room';
import { useUiStore } from '../../store/ui';

/** Confirmación antes de salir de la sala (cabecera o final). */
export function LeaveDialog() {
  const open = useUiStore((s) => s.dialog === 'leave');
  const close = useUiStore((s) => s.closeDialog);
  const room = useRoomStore((s) => s.room);
  if (!open || !room) return null;
  const playing = room.status === 'playing' || room.status === 'paused';
  const others = room.players.filter((p) => p.id !== room.you.id && !p.left && !p.bot).length;
  return (
    <ConfirmDialog
      label="Salir de la sala"
      title={playing ? '¿Abandonar la partida?' : '¿Salir de la sala?'}
      sub={playing ? 'Tu asiento se queda vacío.' : undefined}
      confirmLabel={playing ? 'Abandonar' : 'Salir'}
      cancelLabel="Quedarme"
      onCancel={close}
      onConfirm={() => {
        useRoomStore.getState().leave();
        close();
      }}
    >
      {playing
        ? `La partida no puede continuar sin ti: la mesa quedará en pausa${others > 0 ? ' para los demás jugadores' : ''}. Si no vuelves, el anfitrión tendrá que terminarla.`
        : 'Dejarás tu asiento. Podrás volver a entrar con el código mientras la partida no haya empezado.'}
    </ConfirmDialog>
  );
}
