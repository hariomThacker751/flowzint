import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";
import { confirmPayment, getBookingByEnquiry, bookCorrugators, checkCorrugatorFeasibility } from "@/lib/server/corrugator-capacity";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { getOrCreateOrderForEnquiry } from "@/lib/server/services/order";
import { confirmTokenPayment } from "@/lib/server/services/payment";
import { sendTemplated } from "@/lib/server/services/outbox";
import { toPaise, formatINR } from "@/lib/server/money";

export const runtime = "nodejs";

const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/**
 * POST /api/orders/confirm-payment
 *
 * Human-in-the-loop token confirmation (Impl Spec §2). Requires authentication;
 * records the named approver + token amount + stamp; advances the order into
 * production; books corrugators; notifies the customer. The agent never reaches here.
 *
 * Body: { enquiryId: string, tokenAmount?: number, screenshotRef?: string }
 */
export async function POST(req: Request) {
  let approver: { name: string; role: Role };
  try {
    const session = assertRole(req, ALLOWED);
    approver = { name: session.name, role: session.role };
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { enquiryId, tokenAmount, screenshotRef } = body as {
      enquiryId?: string;
      tokenAmount?: number;
      screenshotRef?: string;
    };
    if (!enquiryId) return NextResponse.json({ error: "enquiryId is required" }, { status: 400 });

    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT e.*, c.phone, c.language, c.id as customer_id, c.name as customer_name
         FROM enquiries e JOIN customers c ON e.customer_id = c.id WHERE e.id = ?`
      )
      .get(enquiryId) as any;
    if (!row) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });

    // ── Resolve the order and record the stamped token payment ───────────────
    const order = getOrCreateOrderForEnquiry(enquiryId, "order_confirmed");
    const tokenPaise = typeof tokenAmount === "number" && tokenAmount > 0 ? toPaise(tokenAmount) : 0;
    const { stamp, orderStatus } = confirmTokenPayment({
      orderId: order.id,
      tokenAmountPaise: tokenPaise,
      approver: approver.name,
      approverRole: approver.role,
      screenshotRef,
    });

    // Keep legacy enquiry/quote state in sync for the existing dashboard.
    db.prepare(`UPDATE enquiries SET status = 'in_production', updated_at = datetime('now') WHERE id = ?`).run(enquiryId);
    db.prepare(`UPDATE quotes SET owner_approved = 1 WHERE enquiry_id = ?`).run(enquiryId);
    db.prepare(`UPDATE customers SET stage = 'awaiting_gst', updated_at = datetime('now') WHERE id = ?`).run(row.customer_id);

    // ── Book corrugators (idempotent) ──────────────────────────────────────────────
    let corrugatorBooking = getBookingByEnquiry(enquiryId);
    if (!corrugatorBooking && row.quantity_kg > 0) {
      const feasibility = checkCorrugatorFeasibility(row.quantity_kg, {
        sizeInches: row.size_inches,
        grammage: row.grammage,
        quality: row.quality,
      });
      if (feasibility.feasible) {
        const result = bookCorrugators(enquiryId, row.customer_id, row.quantity_kg);
        corrugatorBooking = result.booking;
      } else {
        await appendLog("corrugator_feasibility_blocked", { enquiryId, reason: feasibility.reason });
      }
    }
    if (corrugatorBooking) confirmPayment(corrugatorBooking.id);

    // ── Notify the customer: token received, production started (native T14) ──
    const deliveryDays = corrugatorBooking?.delivery_estimate_days || 7;
    const etaDate = new Date(Date.now() + deliveryDays * 86400000).toLocaleDateString("en-GB");
    let renderedText = "";
    try {
      const result = await sendTemplated({
        phone: row.phone,
        customerId: row.customer_id,
        templateId: "T14",
        customerLanguage: row.language,
        vars: {
          CLIENT_NAME: row.customer_name || "",
          ORDER_ID: order.order_no,
          TOKEN_AMT: tokenPaise > 0 ? `₹${formatINR(tokenPaise)}` : "received",
          ETA_DATE: etaDate,
        },
        dedupKey: `${order.id}:T14`,
      });
      renderedText = result.text;
      if (renderedText) {
        db.prepare(
          `INSERT INTO chat_messages (id, customer_id, channel, role, content, metadata) VALUES (?, ?, 'customer_whatsapp', 'assistant', ?, ?)`
        ).run(crypto.randomUUID(), row.customer_id, renderedText, JSON.stringify({ source: "confirm_payment_api", type: "T14" }));
      }
    } catch (err) {
      console.error("Failed to send T14:", err);
    }

    await appendLog("payment_confirmed", {
      enquiryId,
      orderId: order.id,
      orderNo: order.order_no,
      approver: approver.name,
      stamp,
      tokenPaise,
      phone: row.phone,
      status: orderStatus,
    });

    return NextResponse.json({
      success: true,
      orderNo: order.order_no,
      orderStatus,
      stamp,
      tokenAmount: tokenPaise ? formatINR(tokenPaise) : null,
      corrugatorBooking: corrugatorBooking
        ? { id: corrugatorBooking.id, monthKey: corrugatorBooking.month_key, kgBooked: corrugatorBooking.kg_booked, estimatedDays: corrugatorBooking.delivery_estimate_days }
        : null,
    });
  } catch (error) {
    console.error("Payment Confirmation Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

