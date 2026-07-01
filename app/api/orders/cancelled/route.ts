import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

/**
 * GET /api/orders/cancelled
 * Returns all cancelled orders with full audit trail (Section 13).
 * Retained for 90 days for risk management and client flagging.
 */
export async function GET() {
  try {
    const db = getDatabase();
    let orders: any[] = [];
    try {
      orders = db.prepare(`
        SELECT id, enquiry_id, customer_id, customer_name, customer_phone,
               size_inches, grammage, quality, color, lamination, quantity_kg,
               order_value, token_min, token_max, confirmed_at, cancelled_at,
               days_elapsed, followups_sent, reason, cancelled_by, client_flagged, notes,
               created_at
        FROM cancelled_orders
        ORDER BY cancelled_at DESC
        LIMIT 200
      `).all();
    } catch (err) {
      // Table may not exist yet if schema hasn't initialized — return empty
      return NextResponse.json({ ok: true, orders: [] });
    }

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch cancelled orders" },
      { status: 500 },
    );
  }
}

