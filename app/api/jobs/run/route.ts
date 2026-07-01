import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";
import { getCompanyConfig } from "@/lib/server/services/policy";
import { fireTrigger } from "@/lib/server/services/triggers";
import {
  computeDueReminders,
  computeDueCancellations,
  executeCancellation,
  markReminderSent,
} from "@/lib/server/services/dunning";
import {
  getBatchesNeedingDispatchAlert,
  getCompletedBatchesPendingReady,
  markBatchComplete,
  markDispatchAlertSent,
} from "@/lib/server/services/production";
import { sendTemplated, processOutbox } from "@/lib/server/services/outbox";
import { deriveAllProfiles, rebuildSeasonalAggregates } from "@/lib/server/services/demand";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/jobs/run — the scheduled job runner (Phase 3/4).
 *
 * Idempotent. Invoked by an external scheduler (cron / Vercel Cron / GitHub
 * Action) every ~15 min, OR by a logged-in user. All customer-facing sends go
 * through the native-language template registry + outbox (no English fallback).
 * Internal-group notices stay in English (spec §15: hierarchy comms in English).
 *
 * Auth: `Authorization: Bearer <JOBS_SECRET>` or a session.
 */
function authorize(req: Request): boolean {
  const secret = process.env.JOBS_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (secret && auth === `Bearer ${secret}`) return true;
  return Boolean(getSession(req));
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const summary = { reminders: 0, cancellations: 0, dispatchAlerts: 0, completions: 0, postDelivery: 0, demandProfiles: 0, seasonalRows: 0, outboxSent: 0, outboxFailed: 0, errors: 0 };
  const company = getCompanyConfig();
  const db = getDatabase();

  // 1. Token reminders (T12 / T13) — native, deduped per order+template
  try {
    for (const a of computeDueReminders()) {
      if (a.kind !== "reminder") continue;
      await sendTemplated({
        phone: a.phone,
        customerId: a.customerId,
        templateId: a.templateId,
        customerLanguage: a.customerLanguage,
        vars: a.vars,
        dedupKey: `${a.orderId}:${a.templateId}`,
      });
      markReminderSent(a.orderId, a.day);
      summary.reminders++;
    }
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_reminders_error", { error: String(e) });
  }

  // 2. Auto-cancellations (T15) + client flag + hierarchy notify (English)
  try {
    for (const a of computeDueCancellations()) {
      if (a.kind !== "cancel") continue;
      executeCancellation(a.orderId, "non_payment", "Auto (system)");
      await sendTemplated({
        phone: a.phone,
        customerId: a.customerId,
        templateId: a.templateId,
        customerLanguage: a.customerLanguage,
        vars: a.vars,
        dedupKey: `${a.orderId}:T15`,
      });
      if (company.internalGroupPhone) {
        try { await sendSessionMessage(company.internalGroupPhone, a.internalMessage); } catch {}
      }
      summary.cancellations++;
    }
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_cancellations_error", { error: String(e) });
  }

  // 3. 3-day dispatch alerts (T18) — native
  try {
    for (const b of getBatchesNeedingDispatchAlert()) {
      await sendTemplated({
        phone: b.phone,
        customerId: b.customer_id,
        templateId: "T18",
        customerLanguage: b.language,
        vars: {
          CLIENT_NAME: b.customer_name || "",
          ORDER_ID: b.order_no,
          SPEC: b.spec || "",
          QTY: `${b.order_qty_kg}kg`,
          DISPATCH_DATE: b.revised_eta || "",
        },
        dedupKey: `${b.id}:T18`,
      });
      markDispatchAlertSent(b.id);
      summary.dispatchAlerts++;
    }
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_dispatch_alerts_error", { error: String(e) });
  }

  // 4. Completed batches → ready_dispatch + internal notify (English)
  try {
    for (const b of getCompletedBatchesPendingReady()) {
      markBatchComplete(b.id);
      if (company.internalGroupPhone) {
        try { await sendSessionMessage(company.internalGroupPhone, `Batch ${b.batch_no} complete — order ${b.order_no} ready for dispatch.`); } catch {}
      }
      summary.completions++;
    }
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_completions_error", { error: String(e) });
  }

  // 5. Post-delivery follow-up (T31) — 3+ days after dispatch, once per order
  try {
    const rows = db
      .prepare(
        `SELECT o.id, o.order_no, o.size_inches, o.grammage, o.quality,
                c.id AS customer_id, c.name AS customer_name, c.phone, c.language
         FROM dispatch d JOIN orders o ON d.order_id = o.id JOIN customers c ON o.customer_id = c.id
         WHERE d.dispatched_at <= datetime('now','-3 days')
           AND NOT EXISTS (SELECT 1 FROM outbox WHERE dedup_key = o.order_no || ':T31')`
      )
      .all() as any[];
    for (const o of rows) {
      await fireTrigger("post_delivery", {
        phone: o.phone,
        customerId: o.customer_id,
        customerLanguage: o.language,
        vars: { CLIENT_NAME: o.customer_name || "", ORDER_ID: o.order_no, SPEC: `${o.size_inches}" ${o.grammage}g ${o.quality}` },
        dedupKey: `${o.order_no}:T31`,
      });
      summary.postDelivery++;
    }
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_post_delivery_error", { error: String(e) });
  }

  // 6. Demand intelligence — derive profiles from orders + rebuild seasonal aggregates
  try {
    summary.demandProfiles = deriveAllProfiles();
    summary.seasonalRows = rebuildSeasonalAggregates().rows;
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_demand_error", { error: String(e) });
  }

  // 7. Drain any queued/retryable outbox messages
  try {
    const r = await processOutbox(100);
    summary.outboxSent = r.sent;
    summary.outboxFailed = r.failed;
  } catch (e) {
    summary.errors++;
    await appendLog("jobs_outbox_error", { error: String(e) });
  }

  await appendLog("jobs_run", summary);
  return NextResponse.json({ ok: true, summary, ranAt: new Date().toISOString() });
}

