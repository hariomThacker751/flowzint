import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { getCompanyConfig } from "@/lib/server/services/policy";
import { sendTemplated } from "@/lib/server/services/outbox";
import { fireTrigger } from "@/lib/server/services/triggers";
import {
  recordDailyKg,
  markDispatchAlertSent,
  markBatchComplete,
} from "@/lib/server/services/production";

export const runtime = "nodejs";

const ALLOWED: Role[] = ["owner", "dev", "manager"];

/**
 * POST /api/production/daily — production manager enters Actual_KG_Today.
 * Recomputes ETA and fires T17 (ETA shift > 1 day) / T18 (3-day dispatch alert)
 * / dispatch-ready as needed (Impl Spec §4, Guidelines §11).
 *
 * Body: { batchId: string, date?: 'YYYY-MM-DD', actualKg: number }
 */
export async function POST(req: Request) {
  let actor: string;
  try {
    actor = assertRole(req, ALLOWED).name;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { batchId, date, actualKg } = body as { batchId?: string; date?: string; actualKg?: number };
    if (!batchId || typeof actualKg !== "number" || actualKg < 0) {
      return NextResponse.json({ error: "batchId and non-negative actualKg required" }, { status: 400 });
    }
    const prodDate = date || new Date().toISOString().slice(0, 10);

    const result = recordDailyKg(batchId, prodDate, actualKg, actor);
    const db = getDatabase();
    const ctx = db
      .prepare(
        `SELECT b.spec, b.batch_no, b.order_qty_kg, b.revised_eta, b.original_eta, o.order_no,
                c.phone, c.language, c.name AS customer_name, c.id AS customer_id
         FROM production_batches b JOIN orders o ON b.order_id = o.id JOIN customers c ON b.customer_id = c.id
         WHERE b.id = ?`
      )
      .get(batchId) as any;
    const company = getCompanyConfig();
    const fired: string[] = [];

    // T16 — Production Started: fire once, on the first daily entry for the batch.
    const entryCount = (db.prepare(`SELECT COUNT(*) AS n FROM daily_production WHERE batch_id = ?`).get(batchId) as { n: number }).n;
    if (entryCount === 1 && ctx?.phone) {
      await fireTrigger("production_started", {
        phone: ctx.phone,
        customerId: ctx.customer_id,
        customerLanguage: ctx.language,
        vars: { CLIENT_NAME: ctx.customer_name || "", ORDER_ID: ctx.order_no, SPEC: ctx.spec || "", ETA_DATE: result.batch.revised_eta || "" },
        dedupKey: `${batchId}:T16`,
      });
      fired.push("T16");
    }

    // T17 — ETA shifted by more than 1 day (native template)
    if (result.etaShiftedDays > 1 && ctx?.phone) {
      await sendTemplated({
        phone: ctx.phone,
        customerId: ctx.customer_id,
        templateId: "T17",
        customerLanguage: ctx.language,
        vars: {
          CLIENT_NAME: ctx.customer_name || "",
          ORDER_ID: ctx.order_no,
          REASON: "production pace",
          OLD_ETA: ctx.original_eta || "",
          NEW_ETA: result.batch.revised_eta || "",
        },
      });
      fired.push("T17");
    }

    // T18 — within 3 days of dispatch (native template)
    if (result.reachedDispatchWindow && ctx?.phone) {
      await sendTemplated({
        phone: ctx.phone,
        customerId: ctx.customer_id,
        templateId: "T18",
        customerLanguage: ctx.language,
        vars: {
          CLIENT_NAME: ctx.customer_name || "",
          ORDER_ID: ctx.order_no,
          SPEC: ctx.spec || "",
          QTY: `${ctx.order_qty_kg}kg`,
          DISPATCH_DATE: result.batch.revised_eta || "",
        },
        dedupKey: `${batchId}:T18`,
      });
      markDispatchAlertSent(batchId);
      fired.push("T18");
    }

    // Completion → ready for dispatch + internal notify
    if (result.completed) {
      markBatchComplete(batchId, actor);
      if (company.internalGroupPhone) {
        try { await sendSessionMessage(company.internalGroupPhone, `Batch ${ctx?.batch_no} complete — order ${ctx?.order_no} ready for dispatch.`); } catch {}
      }
      fired.push("ready_dispatch");
    }

    await appendLog("production_daily_entry", {
      batchId, prodDate, actualKg, actor,
      pct: result.batch.pct_complete, revisedEta: result.batch.revised_eta, etaStatus: result.batch.eta_status, fired,
    });

    return NextResponse.json({
      ok: true,
      batch: {
        batchNo: result.batch.batch_no,
        cumulativeKg: result.batch.cumulative_kg,
        remainingKg: result.batch.remaining_kg,
        pctComplete: result.batch.pct_complete,
        revisedEta: result.batch.revised_eta,
        etaStatus: result.batch.eta_status,
      },
      fired,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

