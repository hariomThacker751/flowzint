import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { formatINR } from "@/lib/server/money";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/ops/cancellations — cancellation tracker + flagged clients. */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM cancellations ORDER BY cancelled_at DESC LIMIT 100`).all() as any[];
  const cancellations = rows.map((r) => ({
    orderNo: r.order_id,
    customer: r.customer_name,
    phone: r.customer_phone,
    spec: r.spec,
    orderValue: r.order_value_paise != null ? formatINR(r.order_value_paise) : null,
    daysElapsed: r.days_elapsed,
    followUps: r.follow_ups_sent,
    reason: r.reason,
    cancelledBy: r.cancelled_by,
    cancelledAt: r.cancelled_at,
  }));
  const flagged = db
    .prepare(`SELECT name, phone, credit_flag_reason FROM customers WHERE credit_flag = 1 ORDER BY updated_at DESC LIMIT 50`)
    .all();
  return NextResponse.json({ ok: true, cancellations, flagged });
}

