"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MetricCard } from "./metric-card";
import { ApprovalQueue } from "./approval-queue";
import { ActivityFeed } from "./activity-feed";
import { ChartPanel } from "./chart-panel";
import { DispatchSchedule, type DispatchItem } from "./dispatch-schedule";
import { resolveIcon } from "./icon-map";
import type { Tone } from "./tokens";
import { useUIStore } from "@/store/ui-store";
import { useShellStore } from "@/lib/vision-os/shell-store";

/**
 * Vision OS Home — "decide, don't navigate."
 *
 * Layout:
 *  Row 1: Rich Daily Brief (yesterday + actions + escalations) | 14-Day Dispatch
 *  Row 2: Decision Strip | Core Metrics
 *  Row 3: 7-Day Revenue Trend | Live Activity
 */
type Metric = { id: string; label: string; value: string; delta?: string; tone?: Tone; icon?: string };

type BriefData = {
  ok: boolean;
  yesterday: { confirmedOrders: number; confirmedValue: number; quotesCreated: number; quotesValue: number; paymentsReceived: number; newCustomers: number };
  todayActions: { tokensPending: number; escalationsPending: number; quoteApprovals: number; batchesBehind: number; total: number };
  escalations: { id: string; customerName: string; question: string; createdAt: string }[];
  dispatchSchedule: DispatchItem[];
};

const tooltipStyle = { background: "rgba(10,12,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" };

export function VisionHome() {
  const { data: briefData, isLoading: briefLoading } = useQuery<BriefData>({
    queryKey: ["vision-brief"],
    queryFn: () => fetch("/api/brief").then((r) => r.json()),
    refetchInterval: 60000,
  });
  const { data: metricsData, isLoading: metricsLoading } = useQuery<{ ok: boolean; metrics: Metric[]; pendingDecisions: number }>({
    queryKey: ["vision-metrics"],
    queryFn: () => fetch("/api/metrics").then((r) => r.json()),
    refetchInterval: 15000,
  });
  const { data: statsData } = useQuery<{ ok: boolean; stats: any }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const setActiveView = useUIStore((s) => s.setActiveView);
  const openTray = useShellStore((s) => s.setTrayOpen);
  const metrics = metricsData?.metrics || [];
  const b = briefData;
  const y = b?.yesterday;
  const ta = b?.todayActions;

  // Revenue chart
  let revenue: Array<{ day: string; amount: number }> = statsData?.stats?.chartData?.sevenDayRevenue || [];
  if (revenue.length > 0 && revenue.length < 7) {
    const padded: typeof revenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const day = d.toISOString().split("T")[0];
      padded.push(revenue.find((x) => x.day === day) || { day, amount: 0 });
    }
    revenue = padded;
  }

  const isLoading = briefLoading || metricsLoading;

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Vision Command Center</h1>
        <p className="text-sm text-slate-400">Decide, act, execute — from one place</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          {/* Row 1: Rich Daily Brief | 14-Day Dispatch */}
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            {/* Daily Brief */}
            <div className="rounded-xl border border-cyan/20 bg-cyan/[0.04] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-cyan">AI Daily Brief</span>
              </div>

              {/* Yesterday's summary */}
              <div className="mb-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Yesterday</div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <BriefStat label="Orders confirmed" value={y?.confirmedOrders ?? 0} />
                  <BriefStat label="Revenue" value={`₹${((y?.confirmedValue ?? 0) / 100000).toFixed(1)}L`} />
                  <BriefStat label="Quotes created" value={y?.quotesCreated ?? 0} onClick={() => setActiveView("quotes")} />
                  <BriefStat label="Payments received" value={y?.paymentsReceived ?? 0} onClick={() => openTray(true)} />
                  <BriefStat label="New customers" value={y?.newCustomers ?? 0} onClick={() => setActiveView("chats")} />
                </div>
              </div>

              {/* Today's actions */}
              <div className="mb-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Action Pending Today</div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <BriefStat label="Tokens to confirm" value={ta?.tokensPending ?? 0} urgent={(ta?.tokensPending ?? 0) > 0} onClick={() => openTray(true)} />
                  <BriefStat label="Quote approvals" value={ta?.quoteApprovals ?? 0} urgent={(ta?.quoteApprovals ?? 0) > 0} onClick={() => openTray(true)} />
                  <BriefStat label="Customer questions" value={ta?.escalationsPending ?? 0} urgent={(ta?.escalationsPending ?? 0) > 0} onClick={() => openTray(true)} />
                  <BriefStat label="Batches off-track" value={ta?.batchesBehind ?? 0} urgent={(ta?.batchesBehind ?? 0) > 0} onClick={() => setActiveView("corrugator")} />
                </div>
              </div>

              {/* Escalations */}
              {(b?.escalations?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> Escalations
                  </div>
                  <div className="space-y-1.5">
                    {(b?.escalations ?? []).slice(0, 3).map((e) => (
                      <button key={e.id} onClick={() => openTray(true)} className="flex w-full items-start gap-2 rounded-lg border border-white/5 bg-black/20 p-2 text-left hover:bg-white/[0.04]">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-200">{e.customerName}: </span>
                          <span className="text-xs text-slate-400">{e.question.slice(0, 80)}{e.question.length > 80 ? "…" : ""}</span>
                        </div>
                      </button>
                    ))}
                    {(b?.escalations?.length ?? 0) > 3 && (
                      <button onClick={() => openTray(true)} className="text-xs text-amber-400 underline-offset-2 hover:underline">
                        +{(b?.escalations?.length ?? 0) - 3} more
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 14-Day Dispatch */}
            <DispatchSchedule items={b?.dispatchSchedule ?? []} />
          </div>

          {/* Row 2: Decision Strip | Core Metrics */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <ApprovalQueue limit={6} />
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {metrics.map((m, i) => (
                <MetricCard key={m.id} label={m.label} value={m.value} delta={m.delta} tone={(m.tone as Tone) || "cyan"} Icon={resolveIcon(m.icon)} index={i} />
              ))}
            </div>
          </div>

          {/* Row 3: Revenue Trend | Live Activity */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <ChartPanel title="7-Day Revenue Trend" subtitle="Live quotes">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="vision-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38ef7d" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#38ef7d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickMargin={8} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${v / 100000}L`} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="amount" stroke="#38ef7d" fill="url(#vision-rev)" strokeWidth={2} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Live Activity" subtitle="Real-time operations">
              <ActivityFeed limit={8} />
            </ChartPanel>
          </div>
        </>
      )}
    </section>
  );
}

function BriefStat({ label, value, onClick, urgent }: { label: string; value: number | string; onClick?: () => void; urgent?: boolean }) {
  const cls = urgent
    ? "rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-300"
    : "rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-slate-300";
  const el = (
    <span className={cls}>
      <span className="font-semibold">{value}</span> <span className="text-[10px] text-slate-500">{label}</span>
    </span>
  );
  if (!onClick) return el;
  return <button onClick={onClick} className="hover:opacity-80 transition">{el}</button>;
}

