"use client";

/**
 * Embeddable Operations sections (Phase 0–4 backend surfacing).
 *
 * These are consolidated INTO the existing dashboard pages — one capability per
 * home, no duplicate nav entries:
 *   - <DeliveryAnalytics/>  → Analytics page (WhatsApp delivery + job runner)
 *   - <ProductionOps/>      → Production Center (sheet upload + batch ETA)
 *   - <CancellationsOps/>   → Cancelled Orders (real cancellation tracker)
 * Each renders bare cards (no page header/shell) so it slots cleanly under the
 * host page's existing ViewHeader.
 */

import { useRef, useState } from "react";
import { BarChart3, Play, Upload, Truck, Ban, Send } from "lucide-react";
import { Card, Empty, Pill, Stat, Table, useJson } from "./ops-shared";

type Count = { n: number } & Record<string, any>;

/* ── Analytics page: WhatsApp delivery analytics + job runner ─────────────── */
export function DeliveryAnalytics() {
  const outbox = useJson<{ byStatus: Count[]; byTemplate: Count[]; byLanguage: Count[]; recent: any[] }>("ops-outbox", "/api/ops/outbox", 15000);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobResult, setJobResult] = useState("");
  const statusN = (s: string) => outbox.data?.byStatus?.find((x) => x.status === s)?.n ?? 0;

  async function runJobs() {
    setJobBusy(true); setJobResult("");
    try {
      const res = await fetch("/api/jobs/run", { method: "POST", credentials: "include" });
      const d = await res.json();
      setJobResult(res.ok ? `Reminders ${d.summary?.reminders ?? 0} · Cancels ${d.summary?.cancellations ?? 0} · Dispatch ${d.summary?.dispatchAlerts ?? 0} · Post-delivery ${d.summary?.postDelivery ?? 0} · Sent ${d.summary?.outboxSent ?? 0}` : (d.error || "failed"));
      outbox.refetch();
    } catch { setJobResult("network error"); } finally { setJobBusy(false); }
  }

  return (
    <div className="mb-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Sent" value={statusN("sent")} tone="cyan" />
        <Stat label="Delivered" value={statusN("delivered")} tone="green" />
        <Stat label="Read" value={statusN("read")} tone="green" />
        <Stat label="Blocked" value={statusN("blocked")} tone="amber" sub="missing required vars" />
        <Stat label="Failed" value={statusN("failed")} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Run automation" icon={<Play className="h-4 w-4 text-cyan" />}>
          <p className="mb-3 text-xs text-slate-400">Token reminders (T12/T13), auto-cancellations, 3-day dispatch alerts (T18), post-delivery (T31), outbox drain.</p>
          <button onClick={runJobs} disabled={jobBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/20 disabled:opacity-50">
            <Play className="h-4 w-4" /> {jobBusy ? "Running…" : "Run jobs"}
          </button>
          {jobResult && <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">{jobResult}</div>}
        </Card>
        <Card title="Messages by template" icon={<BarChart3 className="h-4 w-4 text-cyan" />}>
          {(outbox.data?.byTemplate?.length ?? 0) === 0 ? <Empty>No messages yet.</Empty> : (
            <div className="space-y-1.5">
              {outbox.data!.byTemplate.map((t) => (
                <div key={t.template_id} className="flex items-center gap-3">
                  <span className="w-12 font-mono text-xs text-slate-300">{t.template_id}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-cyan/60" style={{ width: `${Math.min(100, (t.n / Math.max(...outbox.data!.byTemplate.map((x) => x.n))) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs text-slate-400">{t.n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="By language" icon={<Send className="h-4 w-4 text-cyan" />}>
          {(outbox.data?.byLanguage?.length ?? 0) === 0 ? <Empty>No messages yet.</Empty> : (
            <div className="flex flex-wrap gap-2">
              {outbox.data!.byLanguage.map((l) => (
                <span key={l.language} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">
                  {l.language} <span className="ml-1 text-cyan">{l.n}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent WhatsApp messages" icon={<Send className="h-4 w-4 text-cyan" />}>
        {(outbox.data?.recent?.length ?? 0) === 0 ? <Empty>No outbound messages yet.</Empty> : (
          <Table head={["Template", "Lang", "To", "Channel", "Status", "When"]}>
            {outbox.data!.recent.map((m, i) => (
              <tr key={i} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-xs">{m.template_id}</td>
                <td className="px-3 py-2 text-xs">{m.language}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{m.recipient_phone}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{m.channel}</td>
                <td className="px-3 py-2"><Pill label={m.status} /></td>
                <td className="px-3 py-2 text-[11px] text-slate-500">{m.sent_at || m.created_at}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Production Center: daily sheet upload + batch ETA ────────────────────── */
export function ProductionOps() {
  const batches = useJson<{ batches: any[] }>("ops-batches", "/api/ops/batches", 20000);
  const [upBusy, setUpBusy] = useState(false);
  const [upResult, setUpResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadSheet(file: File) {
    setUpBusy(true); setUpResult("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/production/import-sheet", { method: "POST", credentials: "include", body: fd });
      const d = await res.json();
      setUpResult(res.ok ? `Processed ${d.rowsProcessed}/${d.rowsTotal} · invalid ${d.rowsInvalid} · alerts ${d.alertsQueued}${d.alreadyProcessed ? " (already processed)" : ""}` : (d.error || "failed"));
      batches.refetch();
    } catch { setUpResult("network error"); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <Card title="Daily production sheet" icon={<Upload className="h-4 w-4 text-cyan" />}>
        <p className="mb-3 text-sm text-slate-400">Upload the daily <span className="text-slate-300">Production_Daily</span> .xlsx. Validated (KG 0–500, dates), mapped to batches, run through the ETA engine.</p>
        <input ref={fileRef} type="file" accept=".xlsx" disabled={upBusy}
          onChange={(e) => e.target.files?.[0] && uploadSheet(e.target.files[0])}
          className="block w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan/15 file:px-3 file:py-1 file:text-cyan disabled:opacity-50" />
        {upResult && <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">{upResult}</div>}
      </Card>
      <Card title="Batch ETA tracker" icon={<Truck className="h-4 w-4 text-amber-300" />}>
        {(batches.data?.batches?.length ?? 0) === 0 ? <Empty>No active batches. Batches open when a token is confirmed.</Empty> : (
          <Table head={["Batch", "Order", "%", "ETA", "Status"]}>
            {batches.data!.batches.map((b) => (
              <tr key={b.id} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-xs">{b.batch_no}</td>
                <td className="px-3 py-2 font-mono text-xs text-white">{b.order_no}</td>
                <td className="px-3 py-2 text-xs">{b.pct_complete}%</td>
                <td className="px-3 py-2 text-[11px] text-slate-400">{b.revised_eta}</td>
                <td className="px-3 py-2"><Pill label={b.eta_status} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ── Cancelled Orders: real cancellation tracker + flagged clients ────────── */
export function CancellationsOps() {
  const cancels = useJson<{ cancellations: any[]; flagged: any[] }>("ops-cancels", "/api/ops/cancellations", 30000);
  const list = cancels.data?.cancellations ?? [];
  const flagged = cancels.data?.flagged ?? [];

  return (
    <div className="mb-6 space-y-4">
      <Card title="Cancellation tracker" icon={<Ban className="h-4 w-4 text-rose-400" />} right={<span className="text-xs text-slate-500">{list.length} logged</span>}>
        {list.length === 0 ? <Empty>No auto-cancellations. Orders cancelled for non-payment appear here with full audit.</Empty> : (
          <Table head={["Order", "Customer", "Spec", "Value", "Days", "Reminders", "Reason", "By"]}>
            {list.map((c, i) => (
              <tr key={i} className="text-slate-300">
                <td className="px-3 py-2 font-mono text-xs text-white">{c.orderNo}</td>
                <td className="px-3 py-2 text-xs">{c.customer}</td>
                <td className="px-3 py-2 text-[11px] text-slate-400">{c.spec}</td>
                <td className="px-3 py-2 text-xs">₹{c.orderValue}</td>
                <td className="px-3 py-2 text-xs">{c.daysElapsed}</td>
                <td className="px-3 py-2 text-xs">{c.followUps}</td>
                <td className="px-3 py-2 text-[11px]">{c.reason}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500">{c.cancelledBy}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title="Credit-flagged clients" icon={<Ban className="h-4 w-4 text-rose-400" />} right={<span className="text-xs text-slate-500">{flagged.length}</span>}>
        {flagged.length === 0 ? <Empty>No flagged clients. Cancelled clients require full advance on future orders.</Empty> : (
          <div className="flex flex-wrap gap-2">
            {flagged.map((f, i) => (
              <span key={i} className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300" title={f.credit_flag_reason}>⚑ {f.name}</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

