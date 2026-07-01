import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

/**
 * /api/orders/board — the SINGLE feed for the unified Orders & Money lifecycle
 * board. Replaces the fragmented quotes / payment / dispatch / trading /
 * cancelled views with one normalized order list, each item assigned a
 * lifecycle stage so the board can column them.
 *
 * Lifecycle: enquiry → quote → token_pending → in_production → dispatch → completed
 * (cancelled is surfaced as its own stage / filter).
 *
 * NOTE (Phase E): reads the LEGACY `enquiries`/`quotes` tables for now to match
 * the rest of the dashboard; will move to the unified `orders` aggregate after
 * the data-model consolidation.
 */
export type LifecycleStage =
  | "enquiry"
  | "quote"
  | "token_pending"
  | "in_production"
  | "dispatch"
  | "completed"
  | "cancelled";

/** Map the authoritative orders.status (system of record) to a board stage. */
function stageFromOrderStatus(s: string): LifecycleStage | null {
  switch (s) {
    case "quote_pending_approval":
    case "quote_approved":
      return "quote";
    case "order_confirmed":
    case "awaiting_token":
      return "token_pending";
    case "in_production":
      return "in_production";
    case "ready_dispatch":
    case "dispatched":
      return "dispatch";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/**
 * Resolve a board stage. Prefer the linked `orders` row (the documented system
 * of record); fall back to the legacy enquiry/quote state when no order exists
 * yet (early-stage enquiries are created before an order row). Read-only — does
 * NOT create or mutate orders.
 */
function resolveStage(row: any): LifecycleStage {
  if (row.order_status) {
    const mapped = stageFromOrderStatus(String(row.order_status));
    if (mapped) return mapped;
  }
  const s = String(row.status || "").toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "complete" || s === "completed" || s === "dispatched") return s === "dispatched" ? "dispatch" : "completed";
  if (s === "in_production") return "in_production";
  if (s === "awaiting_payment") return "token_pending";
  if (row.quote_id) return "quote";
  return "enquiry";
}

export async function GET() {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT e.id, e.size_inches, e.grammage, e.quality, e.color, e.lamination,
             e.quantity_kg, e.delivery_city, e.status, e.created_at,
             c.id AS customer_id, c.name AS customer_name, c.company AS customer_company,
             c.phone AS customer_phone,
             COALESCE(q.total_amount, 0) AS quote_amount, q.id AS quote_id, q.owner_approved,
             o.id AS order_id, o.order_no, o.status AS order_status
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN quotes q ON e.id = q.enquiry_id
      LEFT JOIN orders o ON o.enquiry_id = e.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 200
    `).all() as any[];

    const orders = rows.map((r) => ({
      id: r.id,
      orderId: r.order_id || null,
      orderNo: r.order_no || null,
      customerId: r.customer_id,
      customerName: r.customer_company || r.customer_name || "Unknown",
      customerPhone: r.customer_phone,
      spec: `${r.size_inches ?? "?"}" · ${r.grammage ?? "?"}g · ${r.quality || "—"}${r.lamination ? ` · ${r.lamination}` : ""}${r.color ? ` · ${r.color}` : ""}`,
      sizeInches: r.size_inches,
      grammage: r.grammage,
      quality: r.quality,
      color: r.color,
      lamination: r.lamination,
      quantityKg: r.quantity_kg,
      deliveryCity: r.delivery_city,
      amount: r.quote_amount,
      quoteId: r.quote_id,
      ownerApproved: r.owner_approved,
      status: r.order_status || r.status,
      stage: resolveStage(r),
      createdAt: r.created_at,
    }));

    // Stage tallies for the board headers / filters.
    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.stage] = (counts[o.stage] || 0) + 1;

    return NextResponse.json({ ok: true, total: orders.length, counts, orders });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "board failed" },
      { status: 500 },
    );
  }
}

