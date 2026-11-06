import { create } from 'zustand';
import { hapticsPref, type NoticeMode, noticeModePref, wakePref } from '../lib/session';

export type Dialog = 'leave' | 'guide' | 'rules' | null;

interface UiStore {
  dialog: Dialog;
  openDialog(dialog: Exclude<Dialog, null>): void;
  closeDialog(): void;
  /** Cómo se avisa de las jugadas de los demás; se recuerda en el navegador. */
  noticeMode: NoticeMode;
  setNoticeMode(mode: NoticeMode): void;
  /** Vibrar al llegar tu turno (opcional, apagado por omisión). */
  haptics: boolean;
  setHaptics(on: boolean): void;
  /** Mantener la pantalla encendida durante la partida. */
  wake: boolean;
  setWake(on: boolean): void;
}

/** Estado de interfaz compartido entre pantallas (diálogos abiertos desde la cabecera o el final). */
export const useUiStore = create<UiStore>((set) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  noticeMode: noticeModePref.get(),
  setNoticeMode: (noticeMode) => {
    noticeModePref.set(noticeMode);
    set({ noticeMode });
  },
  haptics: hapticsPref.get(),
  setHaptics: (haptics) => {
    hapticsPref.set(haptics);
    set({ haptics });
  },
  wake: wakePref.get(),
  setWake: (wake) => {
    wakePref.set(wake);
    set({ wake });
  },
}));
