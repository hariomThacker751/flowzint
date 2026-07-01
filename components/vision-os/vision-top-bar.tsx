"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Search } from "lucide-react";

import { useUIStore } from "@/store/ui-store";
import { useShellStore } from "@/lib/vision-os/shell-store";
import { areaForView } from "@/lib/vision-os/areas";
import { cn } from "@/lib/utils";

/**
 * Vision OS top bar — shell-level chrome shown above the active area content.
 *
 * Provides: current area title, the ⌘K Command Palette trigger, the global
 * Approval Tray bell (with live pending count), and the user menu + logout.
 * Flag-gated via page.tsx; reversible.
 */
export function VisionTopBar() {
  const activeView = useUIStore((s) => s.activeView);
  const toggleTray = useShellStore((s) => s.toggleTray);
  const area = areaForView(activeView);

  const { data: queue } = useQuery<{ total?: number }>({
    queryKey: ["approval-queue-topbar"],
    queryFn: () => fetch("/api/queue").then((r) => r.json()).catch(() => ({})),
    refetchInterval: 15000,
  });
  const { data: me } = useQuery<{ user?: { name?: string; role?: string } }>({
    queryKey: ["auth-me"],
    queryFn: () => fetch("/api/auth/me").then((r) => r.json()).catch(() => ({})),
  });
  const count = queue?.total ?? 0;

  function openPalette() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <header className="glass flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{area?.label ?? "Vision OS"}</div>
        {area?.description && <div className="truncate text-[10px] text-slate-500">{area.description}</div>}
      </div>

      <button
        onClick={openPalette}
        className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="rounded border border-white/10 px-1 text-[10px]">⌘K</kbd>
      </button>

      <button
        onClick={toggleTray}
        className="relative rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"
        aria-label="Open approval tray"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-medium text-white">
            {count}
          </span>
        )}
      </button>

      {me?.user && (
        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium text-white">{me.user.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{me.user.role}</div>
          </div>
          <button onClick={logout} className={cn("rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white")} title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}

