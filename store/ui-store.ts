import { create } from "zustand";
import type { ViewKey } from "@/lib/data";

export type EscalationContext = {
  escalationId: string;
  customerName: string;
  customerPhone: string;
  question: string;
} | null;

type UIState = {
  activeView: ViewKey;
  activeCustomerId: string;
  collapsed: boolean;
  escalationContext: EscalationContext;
  setActiveView: (view: ViewKey) => void;
  setActiveCustomerId: (id: string) => void;
  toggleCollapsed: () => void;
  setEscalationContext: (ctx: EscalationContext) => void;
  navigateToDirectorWithEscalation: (ctx: EscalationContext) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeView: "chats",
  activeCustomerId: "bio-green",
  collapsed: false,
  escalationContext: null,
  setActiveView: (activeView) => set({ activeView }),
  setActiveCustomerId: (activeCustomerId) => set({ activeCustomerId, activeView: "chats" }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setEscalationContext: (escalationContext) => set({ escalationContext }),
  navigateToDirectorWithEscalation: (ctx) => set({ activeView: "director", escalationContext: ctx }),
}));


