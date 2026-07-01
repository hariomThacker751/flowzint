"use client";

/**
 * Approvals & Escalations — the Human-in-the-Loop queue (Guidelines §8) and the
 * stamped approval audit trail. Surfaces the escalation engine (sub-22", natural
 * box, non-standard colour/grammage, tax/transport holds) and lets the
 * hierarchy resolve/dismiss; every action is stamped server-side.
 */

import { useState } from "react";
import { ShieldCheck, AlertTriangle, Check, X, Stamp } from "lucide-react";
import { Card, Empty, Pill, Stat, Table, useJson } from "./ops-shared";

type Escalation = { id: string; question?: string; customerName?: string; customer_name?: string; customerPhone?: string; customer_phone?: string; trigger_type?: string; created_at?: string; createdAt?: string };
type Approval = { entity_type: string; entity_id: string; action: string; approver: string; approver_role: string; stamp: string; notes?: string; created_at: string };

export default function OpsApprovals() {
  const esc = useJson<{ escalations?: Escalation[]; pendingEscalations?: Escalation[] }>("ops-esc", "/api/escalations", 15000);
  const appr = useJson<{ approvals: Approval[] }>("ops-appr", "/api/ops/approvals", 30000);
  const [busy, setBusy] = useState<string | null>(null);

  const escalations = esc.data?.escalations ?? esc.data?.pendingEscalations ?? [];
  const approvals = appr.data?.approvals ?? [];

  async function act(id: string, action: "resolve" | "dismiss") {
    setBusy(id);
    try {
      await fetch("/api/escalations", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalationId: id, action }),
      });
      esc.refetch();
      appr.refetch();
    } finally { setBusy(null); }
  }

  return (
    <div className="mb-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Pending escalations" value={escalations.length} tone={escalations.length ? "amber" : "green"} />
        <Stat label="Stamped approvals" value={approvals.length} tone="cyan" />
        <Stat label="Token confirmations" value={approvals.filter((a) => a.entity_type === "payment").length} tone="violet" />
      </div>

      <Card title="Pending escalations" icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} className="mb-6"
        right={<span className="text-xs text-slate-500">{escalations.length} awaiting</span>}>
        {escalations.length === 0 ? (
          <Empty>No pending escalations. Restricted specs (sub-22", natural box, non-standard colour) will appear here for approval.</Empty>
        ) : (
          <div className="space-y-2">
            {escalations.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {e.trigger_type && <Pill label={e.trigger_type} />}
                    <span className="text-sm text-white">{e.customerName || e.customer_name || "Customer"}</span>
                    <span className="text-xs text-slate-500">{e.customerPhone || e.customer_phone}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{e.question}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button disabled={busy === e.id} onClick={() => act(e.id, "resolve")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button disabled={busy === e.id} onClick={() => act(e.id, "dismiss")}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:text-rose-300">
                    <X className="h-3.5 w-3.5" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Approval audit trail" icon={<Stamp className="h-4 w-4 text-cyan" />} right={<span className="text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-3 w-3" />stamped</span>}>
        {approvals.length === 0 ? (
          <Empty>No approvals recorded yet. Quote approvals and token confirmations are stamped here.</Empty>
        ) : (
          <Table head={["Type", "Action", "Approver", "Stamp", "Notes"]}>
            {approvals.map((a, i) => (
              <tr key={i} className="text-slate-300">
                <td className="px-3 py-2.5"><Pill label={a.entity_type} /></td>
                <td className="px-3 py-2.5 text-xs">{a.action}</td>
                <td className="px-3 py-2.5 text-xs">{a.approver} <span className="text-slate-500">· {a.approver_role}</span></td>
                <td className="px-3 py-2.5 text-[11px] text-emerald-300">{a.stamp}</td>
                <td className="px-3 py-2.5 text-[11px] text-slate-500">{a.notes || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

