import { create } from 'zustand';

export type Dialog = 'leave' | 'guide' | null;

interface UiStore {
  dialog: Dialog;
  openDialog(dialog: Exclude<Dialog, null>): void;
  closeDialog(): void;
}

/** Estado de interfaz compartido entre pantallas (diálogos abiertos desde la cabecera o el final). */
export const useUiStore = create<UiStore>((set) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}));
