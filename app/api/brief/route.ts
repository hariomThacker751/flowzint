import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

/**
 * /api/brief — structured data for the Vision OS AI Daily Brief.
 *
 * Returns four sections:
 *  - yesterday: orders confirmed, quotes created, payments received, dispatches
 *  - todayActions: pending decisions (token confirmation, escalations, approvals)
 *  - dispatchSchedule: 14-day rolling dispatch window from production_batches + dispatch_schedule
 *  - escalations: open escalations with customer detail
 */
export async function GET() {
  try {
    const db = getDatabase();

    // ── Yesterday summary ─────────────────────────────────────────────────────
    const confirmedYesterday = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(q.total_amount), 0) AS total
      FROM enquiries e
      LEFT JOIN quotes q ON q.enquiry_id = e.id
      WHERE date(e.updated_at) = date('now', '-1 day')
        AND e.status = 'in_production'
    `).get() as { n: number; total: number };

    const quotesYesterday = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS total
      FROM quotes WHERE date(created_at) = date('now', '-1 day')
    `).get() as { n: number; total: number };

    const paymentsYesterday = db.prepare(`
      SELECT COUNT(*) AS n FROM payments
      WHERE date(approved_at) = date('now', '-1 day') AND status = 'confirmed'
    `).get() as { n: number };

    const newCustomersYesterday = db.prepare(`
      SELECT COUNT(*) AS n FROM customers
      WHERE date(created_at) = date('now', '-1 day') AND stage != 'owner'
    `).get() as { n: number };

    // ── Today's pending actions ───────────────────────────────────────────────
    const tokensPending = db.prepare(`
      SELECT COUNT(*) AS n FROM enquiries WHERE status = 'awaiting_payment'
    `).get() as { n: number };

    const escalationsPending = db.prepare(`
      SELECT pe.id, pe.question, pe.created_at, c.name AS customer_name, c.phone AS customer_phone
      FROM pending_escalations pe
      LEFT JOIN customers c ON pe.customer_id = c.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC LIMIT 20
    `).all() as any[];

    const quoteApprovals = db.prepare(`
      SELECT COUNT(*) AS n FROM quotes WHERE owner_approved = 0
    `).get() as { n: number };

    // Batches behind ETA (today's schedule risk)
    const batchesBehind = db.prepare(`
      SELECT COUNT(*) AS n FROM production_batches
      WHERE status = 'running' AND eta_status != 'On Track'
    `).get() as { n: number };

    // ── 14-day dispatch schedule ──────────────────────────────────────────────
    // Prefer production_batches (the authoritative newer model), fall back to
    // dispatch_schedule (legacy) for any rows not yet in the new model.
    const batchSchedule = db.prepare(`
      SELECT b.id, b.batch_no, b.revised_eta AS eta_date, b.eta_status,
             b.order_qty_kg AS quantity_kg, b.pct_complete,
             o.order_no, o.size_inches, o.grammage, o.quality,
             c.name AS customer_name, c.phone AS customer_phone
      FROM production_batches b
      JOIN orders o ON b.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE b.status IN ('running','ready')
        AND b.revised_eta >= date('now')
        AND b.revised_eta <= date('now', '+14 days')
      ORDER BY b.revised_eta ASC
    `).all() as any[];

    const legacySchedule = db.prepare(`
      SELECT id, eta_date, quantity_kg, spec, customer_name,
             status, alert_sent, total_value
      FROM dispatch_schedule
      WHERE eta_date >= date('now')
        AND eta_date <= date('now', '+14 days')
        AND status NOT IN ('dispatched','cancelled')
      ORDER BY eta_date ASC LIMIT 30
    `).all() as any[];

    const dispatchSchedule = [
      ...batchSchedule.map((b: any) => ({
        id: b.id,
        etaDate: b.eta_date,
        customerName: b.customer_name,
        customerPhone: null,
        spec: `${b.size_inches}" ${b.grammage}g ${b.quality}`,
        quantityKg: b.quantity_kg,
        pctComplete: b.pct_complete,
        etaStatus: b.eta_status,
        orderNo: b.order_no,
        source: "production",
      })),
      ...legacySchedule.map((l: any) => ({
        id: l.id,
        etaDate: l.eta_date,
        customerName: l.customer_name,
        customerPhone: null,
        spec: l.spec || "—",
        quantityKg: l.quantity_kg,
        pctComplete: null,
        etaStatus: l.alert_sent ? "Alert Sent" : "Scheduled",
        orderNo: null,
        source: "legacy",
      })),
    ];

    return NextResponse.json({
      ok: true,
      yesterday: {
        confirmedOrders: confirmedYesterday.n,
        confirmedValue: confirmedYesterday.total,
        quotesCreated: quotesYesterday.n,
        quotesValue: quotesYesterday.total,
        paymentsReceived: paymentsYesterday.n,
        newCustomers: newCustomersYesterday.n,
      },
      todayActions: {
        tokensPending: tokensPending.n,
        escalationsPending: escalationsPending.length,
        quoteApprovals: quoteApprovals.n,
        batchesBehind: batchesBehind.n,
        total: tokensPending.n + escalationsPending.length + quoteApprovals.n,
      },
      escalations: escalationsPending.map((e: any) => ({
        id: e.id,
        customerName: e.customer_name || "Unknown",
        customerPhone: e.customer_phone,
        question: e.question,
        createdAt: e.created_at,
      })),
      dispatchSchedule,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "brief failed" },
      { status: 500 },
    );
  }
}

