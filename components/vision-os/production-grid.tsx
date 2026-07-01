"use client";

import { cn } from "@/lib/utils";

/**
 * <ProductionGrid> — the live corrugator-floor digital-twin visual. Reusable across
 * the Production area and (compact) the Home Production panel, replacing the
 * inline corrugator grid duplicated in page.tsx.
 */
export interface FloorState {
  total_corrugators?: number;
  corrugators_available?: number;
  corrugators_in_system?: number;
  corrugators_external?: number;
  corrugators_maintenance?: number;
}

const KIND_CLASS: Record<string, string> = {
  system: "bg-emerald-400/80 shadow-sm shadow-emerald-400/30",
  external: "bg-violet/70",
  maintenance: "bg-amber-400/60",
  free: "bg-slate-700/50 border border-slate-700",
};

export function ProductionGrid({ floor, columns = 15 }: { floor: FloorState; columns?: number }) {
  const total = floor.total_corrugators ?? 45;
  const inSys = floor.corrugators_in_system ?? 0;
  const ext = floor.corrugators_external ?? 0;
  const maint = floor.corrugators_maintenance ?? 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px]">
        <Legend cls="bg-emerald-400/80" label={`System ${inSys}`} />
        <Legend cls="bg-violet/70" label={`External ${ext}`} />
        <Legend cls="bg-amber-400/60" label={`Maint ${maint}`} />
        <Legend cls="bg-slate-700/50 border border-slate-700" label={`Free ${floor.corrugators_available ?? total - inSys - ext - maint}`} />
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: total }).map((_, i) => {
          let kind: keyof typeof KIND_CLASS = "free";
          if (i < inSys) kind = "system";
          else if (i < inSys + ext) kind = "external";
          else if (i < inSys + ext + maint) kind = "maintenance";
          return <div key={i} className={cn("aspect-square rounded-sm transition-all duration-500", KIND_CLASS[kind])} title={`Corrugator ${i + 1}: ${kind}`} />;
        })}
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-400">
      <span className={cn("h-2 w-2 rounded-sm", cls)} /> {label}
    </span>
  );
}

