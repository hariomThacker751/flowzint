import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";
import { bookCorrugators, checkCorrugatorFeasibility } from "@/lib/server/corrugator-capacity";
import { assertRole, AuthError, approvalStamp, APPROVER_ROLES } from "@/lib/server/auth";
import { getOrCreateOrderForEnquiry, appendTimeline } from "@/lib/server/services/order";
import { openTokenWindow } from "@/lib/server/services/dunning";
import { generateProformaInvoice, distributeProformaInvoice } from "@/lib/server/services/invoice";
import { computeTokenRange, getCompanyConfig } from "@/lib/server/services/policy";
import { sendTemplated } from "@/lib/server/services/outbox";
import { fireTrigger } from "@/lib/server/services/triggers";
import { toPaise, formatINR } from "@/lib/server/money";

export const runtime = "nodejs";

/**
 * POST /api/quotes/approve — Deal-Desk approval (Guidelines §8, Impl Spec §1).
 *
 * On approve: stamps the approver, creates the order, AUTO-GENERATES the
 * Proforma Invoice and distributes it to the client + internal group, requests
 * the token advance (10–25%), and books corrugators. Requires owner/dev/manager auth.
 */
export async function POST(req: Request) {
  let approver: { name: string; role: string };
  try {
    const session = assertRole(req, APPROVER_ROLES);
    approver = { name: session.name, role: session.role };
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { quoteId, action } = body as { quoteId?: string; action?: "approve" | "reject" };
    if (!quoteId || !action) {
      return NextResponse.json({ error: "quoteId and action required" }, { status: 400 });
    }

    const db = getDatabase();
    const quote = db
      .prepare(
        `SELECT q.*, c.phone, c.name as customer_name, c.language, c.id as customer_id,
                e.size_inches, e.grammage, e.quality, e.color, e.lamination, e.quantity_kg, e.delivery_city
         FROM quotes q
         JOIN customers c ON q.customer_id = c.id
         LEFT JOIN enquiries e ON q.enquiry_id = e.id
         WHERE q.id = ?`
      )
      .get(quoteId) as any;
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    if (action === "reject") {
      const stamp = approvalStamp("Quote rejected", approver.name);
      db.prepare(`UPDATE quotes SET owner_approved = -1, approved_at = datetime('now'), approval_stamp = ? WHERE id = ?`)
        .run(stamp, quoteId);
      if (quote.enquiry_id) {
        db.prepare(`UPDATE enquiries SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(quote.enquiry_id);
      }
      db.prepare(
        `INSERT INTO approvals (id, entity_type, entity_id, action, approver, approver_role, stamp) VALUES (?, 'quote', ?, 'rejected', ?, ?, ?)`
      ).run(crypto.randomUUID(), quoteId, approver.name, approver.role, stamp);
      await appendLog("quote_rejected", { quoteId, approver: approver.name, stamp });
      return NextResponse.json({ ok: true, rejected: true, stamp });
    }

    if (action !== "approve") {
      return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'" }, { status: 400 });
    }

    // ── 1. Stamp the quote approval ──────────────────────────────────────────
    const stamp = approvalStamp("Quote approved", approver.name);
    db.prepare(
      `UPDATE quotes SET owner_approved = 1, approved_at = datetime('now'), approved_by = ?, approval_stamp = ? WHERE id = ?`
    ).run(approver.name, stamp, quoteId);
    db.prepare(
      `INSERT INTO approvals (id, entity_type, entity_id, action, approver, approver_role, stamp) VALUES (?, 'quote', ?, 'approved', ?, ?, ?)`
    ).run(crypto.randomUUID(), quoteId, approver.name, approver.role, stamp);

    if (quote.enquiry_id) {
      db.prepare(`UPDATE enquiries SET status = 'awaiting_payment', updated_at = datetime('now') WHERE id = ?`).run(quote.enquiry_id);
    }
    db.prepare(`UPDATE customers SET stage = 'awaiting_payment', updated_at = datetime('now') WHERE id = ?`).run(quote.customer_id);

    // ── 2. Create the order (confirmed) and auto-generate + distribute the PI ─
    let orderNo: string | null = null;
    let piNumber: string | null = null;
    let piDistribution: { clientSent: boolean; internalSent: boolean } | null = null;
    if (quote.enquiry_id) {
      try {
        const order = getOrCreateOrderForEnquiry(quote.enquiry_id, "order_confirmed");
        if (order.quote_id == null) {
          db.prepare(`UPDATE orders SET quote_id = ? WHERE id = ?`).run(quoteId, order.id);
        }
        db.prepare(`UPDATE quotes SET order_id = ? WHERE id = ?`).run(order.id, quoteId);
        orderNo = order.order_no;

        // Open the 3-day token window (Guidelines §10.2) — T11 is the message below.
        openTokenWindow(order.id);

        const { invoice } = await generateProformaInvoice(order.id, { quoteRef: quoteId });
        piNumber = invoice.pi_number;

        const internalCaption =
          `New Order Confirmed — ${order.order_no} — ${quote.customer_name} — ` +
          `${quote.size_inches}" ${quote.grammage}g ${quote.quality} ${quote.quantity_kg}kg — ` +
          `₹${formatINR(invoice.grand_total_paise)}. PI ${invoice.pi_number} attached.`;
        piDistribution = await distributeProformaInvoice(invoice.id, {
          clientPhone: quote.phone,
          clientCaption: `Your Proforma Invoice ${invoice.pi_number} is attached. Token advance ₹${formatINR(invoice.token_min_paise)}–₹${formatINR(invoice.token_max_paise)} to start production.`,
          internalCaption,
        });
      } catch (piErr) {
        console.error("[Quote Approve] PI generation/distribution failed:", piErr);
        await appendLog("pi_generation_failed", { quoteId, error: String(piErr) });
      }
    }

    // ── 3. Book corrugators ─────────────────────────────────────────────────────────
    const quantityKg = quote.quantity_kg || 0;
    let corrugatorBooking: any = null;
    let feasibility: any = null;
    if (quantityKg > 0 && quote.enquiry_id) {
      feasibility = checkCorrugatorFeasibility(quantityKg, {
        sizeInches: quote.size_inches,
        grammage: quote.grammage,
        quality: quote.quality,
      });
      if (feasibility.feasible) {
        const result = bookCorrugators(quote.enquiry_id, quote.customer_id, quantityKg);
        corrugatorBooking = result.booking;
        if (!result.success) await appendLog("corrugator_booking_failed", { quoteId, error: result.error });
      } else {
        await appendLog("corrugator_feasibility_failed", { quoteId, reason: feasibility.reason });
      }
    }

    // ── 4. Notify the customer — native order confirmation (T10) then token (T11) ──
    if (quote.phone && orderNo) {
      const tokens = computeTokenRange(toPaise(quote.total_amount));
      // T10 — Order Confirmation (authoritative native confirmation)
      try {
        await fireTrigger("order_confirmation", {
          phone: quote.phone,
          customerId: quote.customer_id,
          customerLanguage: quote.language,
          vars: {
            CLIENT_NAME: quote.customer_name || "",
            SIZE: String(quote.size_inches),
            GRAM: `${quote.grammage}g`,
            GRADE: quote.quality,
            COLOUR: quote.color || "White",
            LAM: quote.lamination || "Unlam",
            QTY: `${quote.quantity_kg}kg`,
            PRICE_PKG: String(quote.unit_price),
            TOTAL_VALUE: formatINR(toPaise(quote.total_amount)),
            TOKEN_MIN: formatINR(tokens.minPaise),
            TOKEN_MAX: formatINR(tokens.maxPaise),
          },
          dedupKey: `${orderNo}:T10`,
        });
      } catch (e) {
        await appendLog("t10_send_failed", { quoteId, error: String(e) });
      }
      // T11 — Day-1 token request (with payment details)
      try {
        const r = await sendTemplated({
          phone: quote.phone,
          customerId: quote.customer_id,
          templateId: "T11",
          customerLanguage: quote.language,
          vars: {
            CLIENT_NAME: quote.customer_name || "",
            ORDER_ID: orderNo,
            TOKEN_MIN: formatINR(tokens.minPaise),
            TOKEN_MAX: formatINR(tokens.maxPaise),
            PAYMENT_DETAILS: getCompanyConfig().bankBlock || "Bank details to follow.",
          },
          dedupKey: `${orderNo}:T11`,
        });
        if (r.text) {
          db.prepare(
            `INSERT INTO chat_messages (id, customer_id, channel, role, content, metadata) VALUES (?, ?, 'customer_whatsapp', 'assistant', ?, ?)`
          ).run(crypto.randomUUID(), quote.customer_id, r.text, JSON.stringify({ source: "quote_approve_api", type: "T11" }));
        }
      } catch (error) {
        await appendLog("owner_approved_whatsapp_failed", { phone: quote.phone, quoteId, error: String(error) });
      }
    }

    if (quote.enquiry_id) {
      appendTimeline(quote.customer_id, null, "quote_approved", `Quote approved. ${stamp}. PI ${piNumber || "n/a"}.`, approver.name);
    }
    await appendLog("quote_approved_full", {
      quoteId,
      enquiryId: quote.enquiry_id,
      orderNo,
      piNumber,
      approver: approver.name,
      stamp,
      corrugatorBooked: corrugatorBooking?.id || null,
    });

    return NextResponse.json({
      ok: true,
      approved: true,
      stamp,
      orderNo,
      piNumber,
      piDistribution,
      enquiryStatus: "awaiting_payment",
      corrugatorBooking: corrugatorBooking
        ? { id: corrugatorBooking.id, monthKey: corrugatorBooking.month_key, kgBooked: corrugatorBooking.kg_booked, estimatedDays: corrugatorBooking.delivery_estimate_days }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

