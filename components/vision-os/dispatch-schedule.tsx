"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SURFACE } from "./tokens";

/**
 * <DispatchSchedule> — 14-day rolling dispatch view, rendered alongside the
 * Daily Brief on the Vision OS Home.
 */
export interface DispatchItem {
  id: string;
  etaDate: string;
  customerName: string;
  spec: string;
  quantityKg?: number;
  pctComplete?: number | null;
  etaStatus?: string;
  orderNo?: string | null;
  source: "production" | "legacy";
}

function etaTone(status?: string): "green" | "amber" | "red" | "slate" {
  if (!status) return "slate";
  const s = status.toLowerCase();
  if (s.includes("track") || s.includes("scheduled")) return "green";
  if (s.includes("risk") || s.includes("alert")) return "amber";
  if (s.includes("delay") || s.includes("behind")) return "red";
  return "slate";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (diff === 0) return `Today (${label})`;
    if (diff === 1) return `Tomorrow (${label})`;
    return `${label} (${diff}d)`;
  } catch { return iso; }
}

export function DispatchSchedule({ items }: { items: DispatchItem[] }) {
  return (
    <div className={cn(SURFACE.panel, "flex flex-col p-5")}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">14-Day Dispatch</h3>
          <p className="text-xs text-slate-400">{items.length} order{items.length !== 1 ? "s" : ""} scheduled</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-600">No dispatches in the next 14 days</div>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="flex w-16 shrink-0 flex-col items-center rounded-lg border border-white/10 bg-black/30 py-1.5">
              <span className="text-[10px] leading-tight text-slate-400">{formatDate(item.etaDate).split("(")[0].trim()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-slate-200">{item.customerName}</span>
                {item.orderNo && <span className="text-[10px] text-slate-500">{item.orderNo}</span>}
              </div>
              <div className="truncate text-[10px] text-slate-400">{item.spec}</div>
              {item.quantityKg && <div className="text-[10px] text-slate-500">{item.quantityKg}kg</div>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={etaTone(item.etaStatus)}>{item.etaStatus || "Scheduled"}</Badge>
              {item.pctComplete != null && (
                <span className="text-[10px] text-slate-500">{Math.round(item.pctComplete)}% done</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

