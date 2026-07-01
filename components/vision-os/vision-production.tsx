"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Factory, RefreshCw, CircleDot, Gauge, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChartPanel } from "./chart-panel";
import { MetricCard } from "./metric-card";
import { ProductionGrid, type FloorState } from "./production-grid";
import { SURFACE } from "./tokens";

/**
 * Vision OS — Production & Capacity (full feature parity with the legacy
 * ProductionCenter: live floor, daily production entry, batch ETA tracker,
 * order queue, and capacity planning). All connected to live backend APIs.
 */
type Tab = "floor" | "batches" | "queue" | "capacity";

export function VisionProduction() {
  const [tab, setTab] = useState<Tab>("floor");
  const [dailyInput, setDailyInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: corrugator, isLoading: corrugatorLoading } = useQuery<{ ok: boolean; floor: FloorState }>({
    queryKey: ["corrugator-floor"],
    queryFn: () => fetch("/api/corrugator").then((r) => r.json()),
    refetchInterval: 15000,
  });
  const { data: prodStatus, isLoading: prodLoading } = useQuery<{ ok: boolean; production: any }>({
    queryKey: ["production-status"],
    queryFn: () => fetch("/api/production/status").then((r) => r.json()),
    refetchInterval: 15000,
  });
  const { data: batchesData, isLoading: batchesLoading } = useQuery<{ ok: boolean; batches: any[] }>({
    queryKey: ["ops-batches"],
    queryFn: () => fetch("/api/ops/batches", { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 15000,
  });

  const floor = corrugator?.floor || {};
  const prod = prodStatus?.production;
  const batches = batchesData?.batches || [];
  const queue = prod?.queue || [];

  const isLoading = corrugatorLoading || prodLoading || batchesLoading;

  const freeCorrugators = floor.corrugators_available ?? 45;
  const totalCorrugators = floor.total_corrugators ?? 45;
  const liveCapT = ((freeCorrugators * 150 * 30) / 1000).toFixed(0);
  const util = prod?.monthly?.utilizationPct ?? 0;
  const bookedT = ((prod?.monthly?.bookedKg || 0) / 1000).toFixed(1);

  async function submitDaily(batchId: string) {
    const kg = parseFloat(dailyInput[batchId] || "0");
    if (!kg || kg <= 0) { alert("Enter a valid kg amount"); return; }
    setSaving(batchId);
    try {
      const r = await fetch("/api/production/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ batchId, actualKg: kg }),
      });
      const j = await r.json();
      if (r.ok) {
        setDailyInput((p) => ({ ...p, [batchId]: "" }));
        qc.invalidateQueries({ queryKey: ["ops-batches"] });
        qc.invalidateQueries({ queryKey: ["corrugator-floor"] });
        qc.invalidateQueries({ queryKey: ["vision-metrics"] });
        alert(`✅ Recorded. ETA: ${j.batch?.revisedEta || "—"} | ${j.batch?.pctComplete?.toFixed(0)}% done`);
      } else {
        alert(`❌ ${j.error || "Failed"}`);
      }
    } finally { setSaving(null); }
  }

  const TABS: { key: Tab; label: string; icon: typeof Factory }[] = [
    { key: "floor", label: "Live Floor", icon: Factory },
    { key: "batches", label: "Batch ETA Tracker", icon: ClipboardList },
    { key: "queue", label: "Order Queue", icon: CircleDot },
    { key: "capacity", label: "Capacity", icon: Gauge },
  ];

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Production &amp; Capacity</h1>
        <p className="text-sm text-slate-400">Live corrugators · batch tracking · order queue · capacity planning</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard label="Free Corrugators" value={`${freeCorrugators} / ${totalCorrugators}`} delta="Available now" tone="green" index={0} />
            <MetricCard label="Live Capacity" value={`${liveCapT}T`} delta="30-day @150kg/corrugator" tone="cyan" index={1} />
            <MetricCard label="Booked This Month" value={`${bookedT}T`} delta="Confirmed orders" tone="violet" index={2} />
            <MetricCard label="Utilization" value={`${util}%`} delta="Current month" tone={util > 80 ? "red" : "amber"} index={3} />
          </div>

          {/* Tab bar */}
          <div className="mt-5 mb-4 flex gap-1 rounded-lg border border-white/5 bg-white/[0.03] p-1 w-fit">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                tab === t.key ? "border border-cyan/30 bg-cyan/20 text-cyan" : "text-slate-400 hover:text-slate-200",
              )}>
                <t.icon className="h-4 w-4" />{t.label}
              </button>
            ))}
          </div>

          {/* Live Floor */}
          {tab === "floor" && (
            <ChartPanel title="Corrugator Floor" subtitle="Live digital twin">
              <ProductionGrid floor={floor} />
              {batches.filter((b) => b.status === "running").length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Active Batches</div>
                  {batches.filter((b) => b.status === "running").map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200">{b.customer} — {b.order_no}</div>
                        <div className="text-[10px] text-slate-500">{b.spec} · {b.order_qty_kg}kg</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-slate-300">{b.pct_complete?.toFixed(0)}%</div>
                          <div className="text-[10px] text-slate-500">ETA {b.revised_eta || "—"}</div>
                        </div>
                        <Badge tone={b.eta_status === "On Track" ? "green" : b.eta_status?.includes("Risk") ? "red" : "amber"}>
                          {b.eta_status || "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartPanel>
          )}

          {/* Batch ETA Tracker + Daily Entry */}
          {tab === "batches" && (
            <div className={cn(SURFACE.panel, "p-5")}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Batch ETA Tracker + Daily Production Sheet</h3>
              {batches.length === 0 && <div className="py-8 text-center text-xs text-slate-600">No active production batches</div>}
              <div className="space-y-4">
                {batches.map((b: any) => (
                  <div key={b.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-200">{b.customer}</span>
                          <span className="text-xs text-slate-500">{b.order_no}</span>
                          {b.batch_no && <span className="text-[10px] border border-white/10 rounded px-1.5 py-0.5 text-slate-400">{b.batch_no}</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{b.spec} · {b.order_qty_kg}kg total</div>
                      </div>
                      <Badge tone={b.eta_status === "On Track" ? "green" : b.eta_status?.includes("Risk") ? "red" : "amber"}>
                        {b.eta_status || b.status}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>{b.cumulative_kg?.toFixed(0)}kg done · {b.remaining_kg?.toFixed(0)}kg remaining</span>
                        <span>{b.pct_complete?.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-emerald-400 transition-all"
                          style={{ width: `${Math.min(100, b.pct_complete || 0)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
                      <span>Original ETA: <strong className="text-slate-300">{b.original_eta || "—"}</strong></span>
                      <span>Revised ETA: <strong className="text-slate-300">{b.revised_eta || "—"}</strong></span>
                      <span>Target: <strong className="text-slate-300">{b.target_kg_day}kg/day</strong></span>
                    </div>

                    {/* Daily entry (only for running batches) */}
                    {b.status === "running" && (
                      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                        <span className="text-xs text-slate-400 shrink-0">Today's production (kg):</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="e.g. 480"
                          value={dailyInput[b.id] || ""}
                          onChange={(e) => setDailyInput((p) => ({ ...p, [b.id]: e.target.value }))}
                          className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan/50"
                        />
                        <button
                          onClick={() => submitDaily(b.id)}
                          disabled={saving === b.id}
                          className="rounded-lg bg-cyan/20 border border-cyan/30 px-3 py-1.5 text-xs text-cyan hover:bg-cyan/30 disabled:opacity-50 transition"
                        >
                          {saving === b.id ? "Saving…" : "Record"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Queue */}
          {tab === "queue" && (
            <div className={cn(SURFACE.panel, "p-5")}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Order Queue</h3>
              {queue.length === 0 && <div className="py-8 text-center text-xs text-slate-600">No orders in the production queue</div>}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      {["Customer","Spec","Qty","Status","Booked","Est. Days","Value"].map((h) => (
                        <th key={h} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((q: any) => (
                      <tr key={q.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="px-3 py-2.5 text-slate-200 font-medium">{q.customerName}</td>
                        <td className="px-3 py-2.5 text-slate-400">{q.sizeInches}" {q.grammage}g {q.quality}</td>
                        <td className="px-3 py-2.5 text-slate-300">{q.quantityKg}kg</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={q.status === "in_production" ? "violet" : q.status === "awaiting_payment" ? "amber" : "green"}>
                            {q.status?.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{q.bookedKg ? `${q.bookedKg}kg` : "—"}</td>
                        <td className="px-3 py-2.5 text-slate-400">{q.deliveryEstimateDays ? `${q.deliveryEstimateDays}d` : "—"}</td>
                        <td className="px-3 py-2.5 text-emerald-300">{q.quoteAmount ? `₹${(q.quoteAmount/1000).toFixed(0)}k` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Capacity Planning */}
          {tab === "capacity" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className={cn(SURFACE.panel, "p-5")}>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Monthly Capacity</div>
                  <div className="text-2xl font-bold text-white">{((prod?.monthly?.availableKg || 0) / 1000).toFixed(0)}T</div>
                  <div className="text-xs text-slate-500 mt-1">available this month</div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-violet transition-all" style={{ width: `${Math.min(100, util)}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{util}% utilized · {bookedT}T booked</div>
                </div>
                <div className={cn(SURFACE.panel, "p-5")}>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Corrugator Status</div>
                  <div className="text-2xl font-bold text-emerald-400">{freeCorrugators}</div>
                  <div className="text-xs text-slate-500 mt-1">corrugators free of {totalCorrugators} total</div>
                  <div className="mt-2 text-xs text-slate-400">
                    <span className="text-violet mr-3">In System: {floor.corrugators_in_system ?? 0}</span>
                    <span className="text-amber-400 mr-3">External: {floor.corrugators_external ?? 0}</span>
                    <span className="text-amber-600">Maint: {floor.corrugators_maintenance ?? 0}</span>
                  </div>
                </div>
                <div className={cn(SURFACE.panel, "p-5")}>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Delivery Calendar</div>
                  {(prod?.deliveryCalendar || []).length === 0 && <div className="text-xs text-slate-600">No upcoming deliveries</div>}
                  <div className="space-y-1.5">
                    {(prod?.deliveryCalendar || []).slice(0, 4).map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate text-slate-300">{d.customerName}</span>
                        <span className="text-slate-500 shrink-0 ml-2">{d.deliveryDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

