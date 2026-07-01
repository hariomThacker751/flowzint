"use client";

import type { ReactNode } from "react";
import { SURFACE } from "./tokens";
import { cn } from "@/lib/utils";

/**
 * <ChartPanel> — reusable titled panel wrapper for charts and content blocks.
 * Replaces the per-page ad-hoc panel markup duplicated across the dashboard.
 */
export function ChartPanel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(SURFACE.panel, "flex flex-col p-6", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

