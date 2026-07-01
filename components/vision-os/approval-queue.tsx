"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeIndianRupee, Check, FileText, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { SURFACE } from "./tokens";

/**
 * <ApprovalQueue> — the SINGLE approvals/attention surface for Vision OS.
 *
 * Replaces the four parallel implementations (ApprovalModal, ApprovalsQueue,
 * AttentionBar, ops-approvals). Reads the centralized /api/queue feed and
 * exposes the right action per item kind. Actions reuse existing, proven
 * endpoints so no business logic changes.
 *
 * This component is designed to live both in the Home "Decision Strip" and in a
 * future global slide-over tray (same component, different container).
 */
type QueueItem = {
  id: string;
  kind: "escalation" | "payment" | "quote";
  title: string;
  subtitle: string;
  meta?: string;
  createdAt?: string;
};

const KIND_META: Record<QueueItem["kind"], { icon: typeof MessageCircle; tone: string; label: string }> = {
  escalation: { icon: MessageCircle, tone: "text-amber-300", label: "Question" },
  payment: { icon: BadgeIndianRupee, tone: "text-emerald-300", label: "Token" },
  quote: { icon: FileText, tone: "text-cyan", label: "Quote" },
};

export function ApprovalQueue({ limit = 8, className }: { limit?: number; className?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery<{ ok: boolean; total: number; items: QueueItem[] }>({
    queryKey: ["approval-queue"],
    queryFn: () => fetch("/api/queue").then((r) => r.json()),
    refetchInterval: 10000,
  });
  const items = (data?.items || []).slice(0, limit);
  const total = data?.total || 0;

  async function confirmPayment(enquiryId: string) {
    if (!confirm("Confirm advance token payment received? The customer will be notified on WhatsApp.")) return;
    const r = await fetch("/api/orders/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enquiryId }),
    });
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["vision-metrics"] });
    } else {
      alert("Failed to confirm payment");
    }
  }

  function goToEscalation(item: QueueItem) {
    useUIStore.getState().navigateToDirectorWithEscalation({
      escalationId: item.id,
      customerName: item.title,
      customerPhone: item.meta || "",
      question: item.subtitle,
    });
  }

  return (
    <div className={cn(SURFACE.panel, "flex flex-col p-5", className)}>
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Needs Your Decision</h3>
          <p className="text-xs text-slate-400">{total} item{total === 1 ? "" : "s"} awaiting action</p>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {items.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-600">All clear — nothing needs your attention.</div>
        )}
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div key={`${item.kind}-${item.id}`} className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-slate-200">{item.title}</span>
                  <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{meta.label}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{item.subtitle}</p>
              </div>
              <div className="shrink-0">
                {item.kind === "payment" ? (
                  <Button onClick={() => confirmPayment(item.id)} className="h-7 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700">
                    <Check className="mr-1 h-3 w-3" /> Confirm
                  </Button>
                ) : item.kind === "escalation" ? (
                  <Button onClick={() => goToEscalation(item)} className="h-7 bg-amber-600 px-2 text-[11px] hover:bg-amber-700">
                    Reply
                  </Button>
                ) : (
                  <Button onClick={() => useUIStore.getState().setActiveView("quotes")} className="h-7 bg-cyan/80 px-2 text-[11px] hover:bg-cyan">
                    Review
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


