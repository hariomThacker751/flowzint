import { Bot } from "lucide-react";
import type { VisionModule } from "./types";
import { SALES_OS_AREAS } from "./areas";

/**
 * Vision OS module registry.
 *
 * The shell renders modules from this registry. Today there is one module
 * (`sales-os` — the current dashboard). To add a future module (e.g. Trading
 * OS), implement a `VisionModule` manifest and push it here; the shell's module
 * rail, Approval Tray, Command Palette and Home metrics pick it up
 * automatically — no shell redesign required.
 */

/** Module #1 — the existing Sales-Agent dashboard, regrouped into 5 areas. */
export const salesOsModule: VisionModule = {
  id: "sales-os",
  label: "Sales OS",
  icon: Bot,
  tagline: "Autonomous WhatsApp box sales",
  areas: SALES_OS_AREAS,
  // Global-slot contributors are wired in Phase B+. The shapes are reserved
  // here so the contract is stable for future modules.
  metrics: {
    endpoint: "/api/metrics",
    metrics: [],
  },
  approvals: {
    endpoint: "/api/queue",
    approverRoles: ["owner", "dev", "manager"],
  },
  commands: [],
  activity: {
    endpoint: "/api/activity",
  },
};

/** All registered Vision OS modules. */
export const VISION_MODULES: VisionModule[] = [salesOsModule];

export function getModule(id: string): VisionModule | undefined {
  return VISION_MODULES.find((m) => m.id === id);
}
