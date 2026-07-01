import { create } from "zustand";

/**
 * Vision OS shell store — global UI state for shell-level elements (the
 * Approval Tray slide-over, etc.) that any module or screen can open. Kept
 * separate from the legacy `ui-store` so the shell layer is self-contained.
 */
type ShellState = {
  trayOpen: boolean;
  setTrayOpen: (open: boolean) => void;
  toggleTray: () => void;
};

export const useShellStore = create<ShellState>((set) => ({
  trayOpen: false,
  setTrayOpen: (trayOpen) => set({ trayOpen }),
  toggleTray: () => set((s) => ({ trayOpen: !s.trayOpen })),
}));
