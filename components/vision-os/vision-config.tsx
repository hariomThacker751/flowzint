"use client";

import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";

import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import type { ViewKey } from "@/lib/data";

/**
 * Vision OS — Configuration center. One tabbed surface that unifies the
 * previously separate Pricing / Templates / Knowledge / Seasonal / Settings
 * pages. It REUSES the existing page components as children (reuse-not-rewrite);
 * the tab strip just switches `useUIStore.activeView`. Flag-gated in page.tsx.
 */
const CONFIG_TABS: { key: ViewKey; label: string }[] = [
  { key: "pricing", label: "Pricing Engine" },
  { key: "templates", label: "Templates" },
  { key: "knowledge", label: "Knowledge Base" },
  { key: "seasonal", label: "Seasonal Demand" },
  { key: "settings", label: "Settings" },
];

export function VisionConfig({ view, children }: { view: ViewKey; children: ReactNode }) {
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-5 py-3">
        <Settings2 className="h-4 w-4 text-cyan" />
        <span className="mr-3 text-sm font-semibold text-white">Configuration</span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {CONFIG_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveView(t.key)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition",
                view === t.key ? "bg-cyan/15 text-cyan" : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

