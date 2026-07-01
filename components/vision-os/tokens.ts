/**
 * Vision OS design tokens (dark "command center" theme).
 *
 * Single source of visual truth for the Vision OS component kit. Every reusable
 * component (MetricCard, ApprovalTray, LifecycleBoard, …) reads tones from here
 * so the look is consistent and themeable later (e.g. enterprise white-label).
 *
 * Tone names match the existing Tailwind custom palette (cyan/violet/emerald/
 * amber/red) already used across the dashboard, so this is drop-in compatible.
 */

export type Tone = "cyan" | "violet" | "green" | "amber" | "red" | "slate";

export interface ToneStyle {
  /** Icon / accent text color. */
  text: string;
  /** Gradient used for large value text. */
  gradient: string;
  /** Subtle background glow. */
  glow: string;
  /** Badge tone (matches components/ui/badge Tone). */
  badge: Tone;
}

export const TONES: Record<Tone, ToneStyle> = {
  cyan: {
    text: "text-cyan",
    gradient: "from-cyan to-blue-500",
    glow: "bg-cyan/5",
    badge: "cyan",
  },
  violet: {
    text: "text-violet",
    gradient: "from-violet to-purple-600",
    glow: "bg-violet/5",
    badge: "violet",
  },
  green: {
    text: "text-emerald-400",
    gradient: "from-emerald-400 to-green-600",
    glow: "bg-emerald-400/5",
    badge: "green",
  },
  amber: {
    text: "text-amber-400",
    gradient: "from-amber-400 to-orange-500",
    glow: "bg-amber-400/5",
    badge: "amber",
  },
  red: {
    text: "text-red-400",
    gradient: "from-red-400 to-rose-600",
    glow: "bg-red-400/5",
    badge: "red",
  },
  slate: {
    text: "text-slate-300",
    gradient: "from-slate-300 to-slate-500",
    glow: "bg-white/5",
    badge: "slate",
  },
};

/** Shared surface classes for cards/panels. */
export const SURFACE = {
  card: "glass rounded-xl border-t border-white/10",
  panel: "glass rounded-xl border border-white/10",
} as const;

