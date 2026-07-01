"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { navItems, type ViewKey } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { SALES_OS_AREAS, areaForView } from "@/lib/vision-os/areas";
import { salesOsModule } from "@/lib/vision-os/registry";

/**
 * Vision OS grouped sidebar (Phase A).
 *
 * Replaces the flat 17-item sidebar with a 2-level structure: 5 areas, each
 * expanding to its grouped legacy views. It drives the SAME `useUIStore`
 * `activeView`, so every existing view renders unchanged via `MainView`. This
 * is purely additive and reversible — gated by VISION_OS_ENABLED in page.tsx.
 */

// Lookup: ViewKey -> legacy nav metadata (label + icon) for sub-items.
const VIEW_META: Record<string, { label: string; icon: (typeof navItems)[number]["icon"] }> = Object.fromEntries(
  navItems.map((n) => [n.key, { label: n.label, icon: n.icon }]),
) as Record<string, { label: string; icon: (typeof navItems)[number]["icon"] }>;

type DashboardStats = {
  paymentsPendingCount?: number;
  pendingEscalationsCount?: number;
  activeConversations?: number;
  todayQuotesCount?: number;
  pendingOwnerInputs?: number;
};

export function VisionSidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const collapsed = useUIStore((s) => s.collapsed);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const toggleCollapsed = useUIStore((s) => s.toggleCollapsed);

  const { data } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });
  const stats = data?.stats;

  // Area-level badges derived from the single stats source (no per-tile math).
  const areaBadge: Record<string, string> = {
    home: String((stats?.paymentsPendingCount || 0) + (stats?.pendingEscalationsCount || 0)) || "",
    conversations: stats?.activeConversations ? String(stats.activeConversations) : "",
    orders: stats?.todayQuotesCount ? String(stats.todayQuotesCount) : "",
    production: "",
    config: "",
  };

  const activeArea = areaForView(activeView)?.key ?? "home";

  return (
    <aside
      className={cn(
        "glass-strong z-20 flex h-full shrink-0 flex-col border-r border-white/10 transition-all duration-300",
        collapsed ? "w-[86px]" : "w-[280px]",
      )}
    >
      {/* Module header */}
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <motion.div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 shadow-glow"
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Sparkles className="h-5 w-5 text-cyan" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" />
        </motion.div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xl font-semibold text-ai">VISION OS</div>
            <div className="truncate text-xs text-slate-400">{salesOsModule.label}</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleCollapsed} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Areas + grouped sub-views */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {SALES_OS_AREAS.map((area) => {
          const AreaIcon = area.icon;
          const isActiveArea = activeArea === area.key;
          const badge = areaBadge[area.key];
          return (
            <div key={area.key} className="space-y-1">
              <button
                onClick={() => setActiveView(area.defaultView)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-all",
                  isActiveArea
                    ? "border-cyan/30 bg-cyan/10 text-white shadow-glow"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <AreaIcon className={cn("h-5 w-5 shrink-0 transition-colors", isActiveArea ? "text-cyan" : "text-slate-500 group-hover:text-cyan")} />
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{area.label}</span>
                    {area.description && (
                      <span className="block truncate text-[10px] text-slate-500">{area.description}</span>
                    )}
                  </span>
                )}
                {!collapsed && badge && (
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">{badge}</span>
                )}
                {isActiveArea && <motion.span layoutId="vision-nav-glow" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan" />}
              </button>

              {/* Sub-views for the active area (hidden for unified areas). */}
              {!collapsed && isActiveArea && !area.unified && area.views.length > 1 && (
                <div className="ml-4 space-y-0.5 border-l border-white/10 pl-2">
                  {area.views.map((view) => {
                    const meta = VIEW_META[view];
                    if (!meta) return null;
                    const SubIcon = meta.icon;
                    const active = activeView === view;
                    return (
                      <button
                        key={view}
                        onClick={() => setActiveView(view as ViewKey)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-all",
                          active ? "bg-cyan/10 text-cyan" : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                        )}
                      >
                        <SubIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 px-4 py-3 text-[10px] text-slate-500">
          Vision OS · Module 1 of 1
        </div>
      )}
    </aside>
  );
}

