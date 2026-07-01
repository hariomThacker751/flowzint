"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONES, SURFACE, type Tone } from "./tokens";

/**
 * <MetricCard> — the single, reusable KPI tile for Vision OS.
 *
 * Replaces the two competing KPI-card implementations (the inline dark cards in
 * page.tsx and the light-theme components/dashboard/kpi-cards.tsx) plus the
 * scattered nav-badge / inline-stat math. A metric is defined ONCE and rendered
 * consistently everywhere it appears.
 *
 * Values should come from the centralized metrics service (Phase B: /api/metrics)
 * so the same number is never recomputed per-surface.
 */
export interface MetricCardProps {
  label: string;
  value: string;
  /** Small contextual delta/subtitle, e.g. "Last 24h" or "₹4.2L". */
  delta?: string;
  tone?: Tone;
  Icon?: LucideIcon;
  /** Optional click to drill into the source. */
  onClick?: () => void;
  /** Animation order index for staggered entrance. */
  index?: number;
}

export function MetricCard({
  label,
  value,
  delta,
  tone = "cyan",
  Icon,
  onClick,
  index = 0,
}: MetricCardProps) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={cn(
        SURFACE.card,
        "scan-line group relative overflow-hidden p-5",
        t.glow,
        onClick && "cursor-pointer hover:border-white/20",
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "absolute -right-4 -bottom-4 h-24 w-24 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-10",
            t.text,
          )}
        />
      )}
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className={cn("h-4 w-4", t.text)} />}
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        </div>
        <div className={cn("mt-3 bg-gradient-to-br bg-clip-text text-3xl font-bold tracking-tight text-transparent", t.gradient)}>
          {value}
        </div>
        {delta && (
          <div className="mt-auto flex items-center justify-between pt-4">
            <Badge tone={t.badge}>{delta}</Badge>
          </div>
        )}
      </div>
    </motion.div>
  );
}

