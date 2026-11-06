import { create } from 'zustand';
import { type NoticeMode, noticeModePref } from '../lib/session';

export type Dialog = 'leave' | 'guide' | 'rules' | null;

interface UiStore {
  dialog: Dialog;
  openDialog(dialog: Exclude<Dialog, null>): void;
  closeDialog(): void;
  /** Cómo se avisa de las jugadas de los demás; se recuerda en el navegador. */
  noticeMode: NoticeMode;
  setNoticeMode(mode: NoticeMode): void;
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
}));
