"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LIFECYCLE_STAGES, type BoardOrder } from "@/lib/vision-os/lifecycle";

/**
 * <LifecycleBoard> — the unified order kanban (enquiry → … → completed).
 * Replaces the static status grids and the separate per-stage pages. Click a
 * card to open the <OrderDrawer>.
 */
export function LifecycleBoard({
  orders,
  onSelect,
}: {
  orders: BoardOrder[];
  onSelect: (o: BoardOrder) => void;
}) {
  // Show the operational stages as columns; "cancelled" is handled via filter.
  const columns = LIFECYCLE_STAGES.filter((s) => s.key !== "cancelled");

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map((col) => {
        const items = orders.filter((o) => o.stage === col.key);
        return (
          <div key={col.key} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{col.label}</span>
              <Badge tone={col.tone}>{items.length}</Badge>
            </div>
            <div className="flex-1 space-y-2">
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/5 py-6 text-center text-[10px] text-slate-600">empty</div>
              )}
              {items.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onSelect(o)}
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  <div className="truncate text-xs font-semibold text-slate-200">{o.customerName}</div>
                  <div className="mt-1 truncate text-[10px] text-slate-500">{o.spec}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{o.quantityKg ? `${o.quantityKg}kg` : "—"}</span>
                    {o.amount ? <span className="text-[10px] font-medium text-emerald-300">₹{(o.amount / 1000).toFixed(0)}k</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

