"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * <ActivityFeed> — reusable real-time operational feed.
 * Replaces the duplicated activity-list markup (LiveActivityList in page.tsx
 * and components/dashboard/activity-feed.tsx).
 */
type ActivityEvent = {
  eventType?: string;
  event_type?: string;
  actor?: string;
  createdAt?: string;
  created_at?: string;
  payload?: any;
};

const TONE_DOT: Record<string, string> = {
  quote: "bg-cyan",
  payment: "bg-emerald-400",
  escalation: "bg-amber-400",
  error: "bg-red-400",
  default: "bg-slate-500",
};

function dotFor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("quote")) return TONE_DOT.quote;
  if (t.includes("pay")) return TONE_DOT.payment;
  if (t.includes("escal") || t.includes("owner")) return TONE_DOT.escalation;
  if (t.includes("error") || t.includes("fail")) return TONE_DOT.error;
  return TONE_DOT.default;
}

function timeAgo(s?: string): string {
  if (!s) return "";
  const ts = new Date(s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : s + "Z").getTime();
  if (isNaN(ts)) return "";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivityFeed({ limit = 12, className }: { limit?: number; className?: string }) {
  const { data } = useQuery<{ ok: boolean; events: ActivityEvent[] }>({
    queryKey: ["activity-feed", limit],
    queryFn: () => fetch(`/api/activity?limit=${limit}`).then((r) => r.json()),
    refetchInterval: 5000,
  });
  const events = data?.events || [];

  return (
    <div className={cn("space-y-2", className)}>
      {events.length === 0 && (
        <div className="py-6 text-center text-xs text-slate-600">No recent activity</div>
      )}
      {events.map((e, i) => {
        const type = (e.eventType || e.event_type || "event").toString();
        const when = e.createdAt || e.created_at;
        return (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotFor(type))} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-200">{type.replace(/_/g, " ")}</div>
              {e.actor && <div className="truncate text-[10px] text-slate-500">{e.actor}</div>}
            </div>
            <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(when)}</span>
          </div>
        );
      })}
    </div>
  );
}

