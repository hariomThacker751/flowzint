"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * <DataTable> — a single generic table used across Vision OS (orders, quotes,
 * cancellations, etc.), replacing the per-page ad-hoc table markup.
 */
export interface Column<T> {
  key: string;
  header: string;
  /** Render a cell; defaults to String(row[key]). */
  cell?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty = "No records",
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-500", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-slate-600">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-white/5 transition",
                onRowClick && "cursor-pointer hover:bg-white/[0.04]",
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2.5 text-slate-300", c.className)}>
                  {c.cell ? c.cell(row) : String((row as any)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

