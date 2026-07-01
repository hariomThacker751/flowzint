import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

/**
 * /api/queue — the SINGLE feed for the global Approval Tray.
 *
 * Aggregates everything awaiting an owner decision into one typed list,
 * replacing the four separate approval UIs (ApprovalModal, ApprovalsQueue,
 * AttentionBar, ops-approvals). Each item carries enough context to act and to
 * write an audit record.
 *
 * Item kinds: "escalation" (customer question) | "payment" (token to confirm) |
 * "quote" (quote pending owner approval).
 */
export async function GET() {
  try {
    const db = getDatabase();

    const escalations = db.prepare(`
      SELECT pe.id, pe.question, pe.holding_message, pe.created_at,
             c.name AS customer_name, c.phone AS customer_phone
      FROM pending_escalations pe
      LEFT JOIN customers c ON pe.customer_id = c.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC LIMIT 50
    `).all() as any[];

    const payments = db.prepare(`
      SELECT e.id AS enquiry_id, e.quantity_kg, e.quality, e.size_inches, e.grammage, e.created_at,
             c.name AS customer_name, c.phone AS customer_phone
      FROM enquiries e JOIN customers c ON e.customer_id = c.id
      WHERE e.status = 'awaiting_payment'
      ORDER BY e.created_at DESC LIMIT 50
    `).all() as any[];

    const quotes = db.prepare(`
      SELECT q.id, q.unit_price, q.total_amount, q.created_at,
             c.name AS customer_name, c.phone AS customer_phone
      FROM quotes q JOIN customers c ON q.customer_id = c.id
      WHERE q.owner_approved = 0
      ORDER BY q.created_at DESC LIMIT 50
    `).all() as any[];

    const items = [
      ...escalations.map((e) => ({
        id: e.id,
        kind: "escalation" as const,
        title: e.customer_name || "Customer",
        subtitle: e.question,
        meta: e.customer_phone,
        createdAt: e.created_at,
      })),
      ...payments.map((p) => ({
        id: p.enquiry_id,
        kind: "payment" as const,
        title: p.customer_name || "Customer",
        subtitle: `${p.quantity_kg ?? "?"}kg · ${p.size_inches ?? "?"}" · ${p.grammage ?? "?"}g · ${p.quality || "Standard"}`,
        meta: p.customer_phone,
        createdAt: p.created_at,
      })),
      ...quotes.map((q) => ({
        id: q.id,
        kind: "quote" as const,
        title: q.customer_name || "Customer",
        subtitle: `Quote ₹${(q.total_amount || 0).toLocaleString("en-IN")} · ₹${q.unit_price}/kg`,
        meta: q.customer_phone,
        createdAt: q.created_at,
      })),
    ];

    return NextResponse.json({
      ok: true,
      total: items.length,
      counts: { escalations: escalations.length, payments: payments.length, quotes: quotes.length },
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "queue failed" },
      { status: 500 },
    );
  }
}

