"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, RefreshCw, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LifecycleBoard } from "./lifecycle-board";
import { OrderDrawer } from "./order-drawer";
import { DataTable, type Column } from "./data-table";
import { LIFECYCLE_STAGES, STAGE_META, type BoardOrder, type LifecycleStage } from "@/lib/vision-os/lifecycle";

/**
 * Vision OS — Orders & Money. One lifecycle view that replaces the fragmented
 * quotes / payment / dispatch / trading / cancelled pages. Board or table view,
 * stage filter, and an <OrderDrawer> for drill-down. Flag-gated in page.tsx.
 */
type Mode = "board" | "table";

export function VisionOrders() {
  const [mode, setMode] = useState<Mode>("board");
  const [filter, setFilter] = useState<LifecycleStage | "all">("all");
  const [selected, setSelected] = useState<BoardOrder | null>(null);

  const { data, isLoading } = useQuery<{ ok: boolean; orders: BoardOrder[]; counts: Record<string, number>; total: number }>({
    queryKey: ["orders-board"],
    queryFn: () => fetch("/api/orders/board").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const orders = useMemo(() => data?.orders || [], [data]);
  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.stage === filter)),
    [orders, filter],
  );

  const columns: Column<BoardOrder>[] = [
    { key: "customerName", header: "Customer", cell: (o) => <span className="font-medium text-slate-200">{o.customerName}</span> },
    { key: "spec", header: "Spec", cell: (o) => <span className="text-slate-400">{o.spec}</span> },
    { key: "quantityKg", header: "Qty", cell: (o) => (o.quantityKg ? `${o.quantityKg}kg` : "—") },
    { key: "amount", header: "Amount", cell: (o) => (o.amount ? `₹${o.amount.toLocaleString("en-IN")}` : "—") },
    { key: "stage", header: "Stage", cell: (o) => <Badge tone={STAGE_META[o.stage].tone}>{STAGE_META[o.stage].label}</Badge> },
  ];

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orders &amp; Money</h1>
          <p className="text-sm text-slate-400">Enquiry → Quote → Token → Production → Dispatch → Done</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
          <button onClick={() => setMode("board")} className={cn("rounded-md p-1.5", mode === "board" ? "bg-cyan/15 text-cyan" : "text-slate-400 hover:text-white")} title="Board">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setMode("table")} className={cn("rounded-md p-1.5", mode === "table" ? "bg-cyan/15 text-cyan" : "text-slate-400 hover:text-white")} title="Table">
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stage filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${data?.total ?? 0})`} />
        {LIFECYCLE_STAGES.map((s) => (
          <FilterChip
            key={s.key}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
            label={`${s.label} (${data?.counts?.[s.key] ?? 0})`}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : mode === "board" && filter === "all" ? (
        <LifecycleBoard orders={orders} onSelect={setSelected} />
      ) : (
        <div className="glass rounded-xl border border-white/10 p-2">
          <DataTable columns={columns} rows={filtered} onRowClick={setSelected} empty="No orders in this stage" />
        </div>
      )}

      <OrderDrawer order={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-white/10 text-slate-400 hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

