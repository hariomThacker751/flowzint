import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { formatINR, toPaise } from "@/lib/server/money";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/ops/overview — order lifecycle (orders + PI + batch ETA + token stamp). */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT o.id, o.order_no, o.status, o.size_inches, o.grammage, o.quality, o.color, o.lamination,
              o.quantity_kg, o.total_amount, o.created_at,
              c.name AS customer, c.phone,
              i.pi_number, i.grand_total_paise, i.tax_type,
              b.batch_no, b.pct_complete, b.revised_eta, b.eta_status,
              (SELECT stamp FROM payments WHERE order_id = o.id AND status = 'confirmed' ORDER BY approved_at DESC LIMIT 1) AS token_stamp
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN invoices i ON i.order_id = o.id
       LEFT JOIN production_batches b ON b.order_id = o.id
       ORDER BY o.created_at DESC LIMIT 100`
    )
    .all() as any[];

  const orders = rows.map((r) => ({
    orderNo: r.order_no,
    status: r.status,
    customer: r.customer,
    spec: `${r.size_inches}" ${r.grammage}g ${r.quality} ${r.color} ${r.lamination} ${r.quantity_kg}kg`,
    total: formatINR(toPaise(r.total_amount || 0)),
    piNumber: r.pi_number || null,
    grandTotal: r.grand_total_paise != null ? formatINR(r.grand_total_paise) : null,
    taxType: r.tax_type || null,
    batchNo: r.batch_no || null,
    pctComplete: r.pct_complete ?? null,
    revisedEta: r.revised_eta || null,
    etaStatus: r.eta_status || null,
    tokenStamp: r.token_stamp || null,
    createdAt: r.created_at,
  }));

  const counts = db
    .prepare(`SELECT status, COUNT(*) AS n FROM orders GROUP BY status`)
    .all() as Array<{ status: string; n: number }>;

  return NextResponse.json({ ok: true, orders, counts });
}

