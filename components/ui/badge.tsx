import { cn } from "@/lib/utils";

type BadgeTone = "cyan" | "violet" | "green" | "amber" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  cyan: "border-cyan/30 bg-cyan/10 text-cyan",
  violet: "border-violet/30 bg-violet/10 text-violet-200",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  red: "border-red-400/30 bg-red-400/10 text-red-200",
  slate: "border-white/10 bg-white/[0.06] text-slate-300",
};

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

