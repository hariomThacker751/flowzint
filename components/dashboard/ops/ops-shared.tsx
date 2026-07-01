"use client";

/**
 * Shared primitives for the isolated Operations (v2) UI layer.
 *
 * Everything new lives under components/dashboard/ops/ and reuses the existing
 * glass design tokens (glass-strong, border-white/10, text-slate-*, text-cyan)
 * so the new sections are visually consistent with the current dashboard. No
 * existing component is modified.
 */

import { useQuery } from "@tanstack/react-query";
import { LogOut, RefreshCw, User2 } from "lucide-react";
import { useState } from "react";

export const cls = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/** Thin typed wrapper over useQuery for authenticated GET JSON. */
export function useJson<T>(key: string, url: string, refetchMs = 20000) {
  return useQuery<T>({
    queryKey: [key],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    refetchInterval: refetchMs,
  });
}

export function Card({ title, icon, right, children, className }: {
  title?: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cls("glass-strong rounded-2xl border border-white/10 p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {icon}
            {title}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "slate" }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  const toneMap: Record<string, string> = {
    cyan: "text-cyan", green: "text-emerald-400", amber: "text-amber-400", red: "text-rose-400", violet: "text-violet-400", slate: "text-white",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cls("mt-1 text-2xl font-semibold", toneMap[tone] || "text-white")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  // order/payment/template/message statuses → colour
  sent: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  read: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  queued: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  blocked: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  submitted: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  in_production: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  ready_dispatch: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  dispatched: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Delayed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "On Track": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Complete: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
};

export function Pill({ label }: { label: string }) {
  const tone = STATUS_TONES[label] || "bg-white/[0.06] text-slate-300 border-white/10";
  return (
    <span className={cls("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium", tone)}>
      {String(label).replace(/_/g, " ")}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">{children}</div>;
}

/** Section header with refresh + account/logout. Used at the top of each panel. */
export function OpsHeader({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  const { data } = useJson<{ user?: { name: string; role: string } }>("ops-me", "/api/auth/me", 0);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/login";
    } finally { setBusy(false); }
  }
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button onClick={onRefresh} className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:text-white" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        {data?.user && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <User2 className="h-4 w-4 text-cyan" />
            <span className="text-xs text-slate-300">{data.user.name} <span className="text-slate-500">· {data.user.role}</span></span>
            <button onClick={logout} disabled={busy} className="ml-1 text-slate-400 transition hover:text-rose-300" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

export function OpsShell({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto p-6">{children}</div>;
}

/**
 * Sidebar account footer — shows the signed-in user and a sign-out button.
 * Isolated; mounted at the bottom of the existing sidebar. Adapts to the
 * collapsed sidebar state. Hidden until authenticated (no /api/auth/me).
 */
export function SidebarAccount({ collapsed }: { collapsed?: boolean }) {
  const { data } = useJson<{ user?: { name: string; role: string } }>("ops-me", "/api/auth/me", 0);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }
  if (!data?.user) return null;
  const initial = (data.user.name || "?").charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <div className="border-t border-white/10 p-3">
        <button onClick={logout} disabled={busy} title={`Sign out (${data.user.name})`}
          className="flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:text-rose-300">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-xs font-semibold text-cyan">{initial}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-white">{data.user.name}</div>
          <div className="truncate text-[10px] capitalize text-slate-500">{data.user.role}</div>
        </div>
        <button onClick={logout} disabled={busy} title="Sign out"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:text-rose-300 disabled:opacity-50">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

