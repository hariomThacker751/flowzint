import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { recordDispatch } from "@/lib/server/services/production";
import { sendTemplated } from "@/lib/server/services/outbox";

export const runtime = "nodejs";

const ALLOWED: Role[] = ["owner", "dev", "manager"];

/**
 * POST /api/orders/dispatch — mark an order dispatched (Guidelines §11) and
 * notify the customer (T20). Body: { orderId, transporter?, vehicleNo?, lrNo?, qtyKg? }
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
    const { orderId, transporter, vehicleNo, lrNo, qtyKg } = body as {
      orderId?: string;
      transporter?: string;
      vehicleNo?: string;
      lrNo?: string;
      qtyKg?: number;
    };
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const updated = recordDispatch(orderId, { transporter, vehicleNo, lrNo, qtyKg, actor });

    const db = getDatabase();
    const cust = db.prepare(`SELECT id, name, phone, language FROM customers WHERE id = ?`).get(updated.customer_id) as any;
    if (cust?.phone) {
      await sendTemplated({
        phone: cust.phone,
        customerId: cust.id,
        templateId: "T20",
        customerLanguage: cust.language,
        vars: {
          CLIENT_NAME: cust.name || "",
          ORDER_ID: updated.order_no,
          SPEC: `${updated.size_inches}" ${updated.grammage}g ${updated.quality}`,
          QTY: `${updated.quantity_kg}kg`,
          DISPATCH_DATE: new Date().toLocaleDateString("en-GB"),
          VEHICLE_NO: vehicleNo || "—",
        },
        dedupKey: `${orderId}:T20`,
      });
    }

    await appendLog("order_dispatched", { orderId, orderNo: updated.order_no, vehicleNo, actor });
    return NextResponse.json({ ok: true, orderNo: updated.order_no, status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

