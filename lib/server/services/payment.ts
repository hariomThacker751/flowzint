import { getDatabase } from "../database";
import { approvalStamp, type Role } from "../auth";
import { advanceOrder, appendTimeline, getOrder } from "./order";
import { createBatchForOrder } from "./production";
import { formatINR } from "../money";

/**
 * Payment service (Implementation Spec §2 — human-in-the-loop, Option A).
 *
 * Payment is ALWAYS confirmed by a named human via the dashboard. This records
 * the token amount, stamps the approver (Guidelines §8), advances the order into
 * production, and writes the audit trail. The agent never confirms payment.
 */

export type PaymentConfirmation = {
  orderId: string;
  tokenAmountPaise: number;
  approver: string;
  approverRole: Role;
  screenshotRef?: string;
};

export function confirmTokenPayment(input: PaymentConfirmation): {
  paymentId: string;
  stamp: string;
  orderStatus: string;
} {
  const db = getDatabase();
  const order = getOrder(input.orderId);
  if (!order) throw new Error(`Order not found: ${input.orderId}`);

  const stamp = approvalStamp("Token confirmed", input.approver);
  const paymentId = crypto.randomUUID();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO payments
        (id, order_id, customer_id, token_amount_paise, screenshot_ref, status, approver, approver_role, approved_at, stamp)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, datetime('now'), ?)`
    ).run(
      paymentId,
      input.orderId,
      order.customer_id,
      input.tokenAmountPaise,
      input.screenshotRef || null,
      input.approver,
      input.approverRole,
      stamp
    );

    db.prepare(
      `INSERT INTO approvals (id, entity_type, entity_id, action, approver, approver_role, stamp, notes)
       VALUES (?, 'payment', ?, 'token_confirmed', ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      input.orderId,
      input.approver,
      input.approverRole,
      stamp,
      `Token ₹${formatINR(input.tokenAmountPaise)}`
    );
  });
  tx();

  // Advance the order: order_confirmed → awaiting_token → in_production.
  if (order.status === "order_confirmed") advanceOrder(input.orderId, "awaiting_token", { actor: input.approver });
  const updated = advanceOrder(input.orderId, "in_production", {
    actor: input.approver,
    note: `Token ₹${formatINR(input.tokenAmountPaise)} confirmed. ${stamp}`,
  });

  // Open a production batch so the ETA engine can track output (Impl Spec §4).
  try {
    createBatchForOrder(input.orderId);
  } catch (e) {
    console.error("[payment] batch creation failed:", e);
  }

  appendTimeline(
    order.customer_id,
    input.orderId,
    "token_received",
    `Token ₹${formatINR(input.tokenAmountPaise)} confirmed by ${input.approver}. Production started. (${stamp})`,
    input.approver
  );

  return { paymentId, stamp, orderStatus: updated.status };
}
