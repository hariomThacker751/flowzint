import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/ops/batches — production batches with live ETA (Impl Spec §4). */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const batches = db
    .prepare(
      `SELECT b.id, b.batch_no, b.spec, b.order_qty_kg, b.target_kg_day, b.cumulative_kg, b.remaining_kg,
              b.pct_complete, b.original_eta, b.revised_eta, b.eta_status, b.dispatch_alert_sent, b.status,
              o.order_no, c.name AS customer
       FROM production_batches b
       JOIN orders o ON b.order_id = o.id
       JOIN customers c ON b.customer_id = c.id
       ORDER BY b.updated_at DESC LIMIT 100`
    )
    .all();
  return NextResponse.json({ ok: true, batches });
}

