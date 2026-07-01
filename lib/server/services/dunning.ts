import { getDatabase } from "../database";
import { getPaymentPolicy, getCompanyConfig, computeTokenRange } from "./policy";
import { advanceOrder, appendTimeline, type OrderRow } from "./order";
import { toPaise, formatINR } from "../money";

/**
 * Token dunning (Guidelines §10.2 / §13).
 *
 *  - On order confirmation, a token window opens (default 3 days).
 *  - Day-1 token request (T11) is sent at approval time. The job runner then
 *    sends Day-2 (T12) and Day-3 (T13) reminders.
 *  - At the end of the window with no confirmed token the order is AUTO-CANCELLED
 *    (safety rails: configurable window, fully audited, hierarchy notified,
 *    client credit-flagged — flag is reversible only by hierarchy).
 *
 * All sends are deferred to the caller via the returned action list when
 * `send=false` (keeps the function pure for tests); when `send=true` the job
 * runner dispatches WhatsApp messages.
 */

export type DunningAction =
  | {
      kind: "reminder";
      orderId: string;
      orderNo: string;
      phone: string;
      customerId: string;
      customerLanguage: string;
      day: number;
      templateId: string; // T12 (day 2) | T13 (day 3)
      vars: Record<string, string | number>;
    }
  | {
      kind: "cancel";
      orderId: string;
      orderNo: string;
      phone: string;
      customerId: string;
      customerLanguage: string;
      templateId: string; // T15
      vars: Record<string, string | number>;
      internalMessage: string; // English — internal group (spec §15)
    };

function hasConfirmedPayment(orderId: string): boolean {
  return Boolean(
    getDatabase().prepare(`SELECT 1 FROM payments WHERE order_id = ? AND status = 'confirmed' LIMIT 1`).get(orderId)
  );
}

/** Open the token window at order confirmation. T11 is sent separately. */
export function openTokenWindow(orderId: string): void {
  const db = getDatabase();
  const { cancellationWindowDays } = getPaymentPolicy();
  db.prepare(
    `UPDATE orders SET token_deadline = datetime('now', ?), follow_ups_sent = 1, last_followup_at = datetime('now')
     WHERE id = ?`
  ).run(`+${cancellationWindowDays} days`, orderId);
}

/** Send Day-2 (T12) / Day-3 (T13) reminders for orders with an open token window. */
export function computeDueReminders(): DunningAction[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT o.*, c.phone, c.language, c.name AS customer_name FROM orders o JOIN customers c ON o.customer_id = c.id
       WHERE o.status IN ('order_confirmed','awaiting_token') AND o.token_deadline IS NOT NULL`
    )
    .all() as Array<OrderRow & { phone: string; language: string; customer_name: string }>;

  const actions: DunningAction[] = [];
  for (const o of rows) {
    if (hasConfirmedPayment(o.id)) continue;
    const confirmedAt = o.confirmed_at ? new Date(o.confirmed_at + "Z").getTime() : Date.parse(o.created_at + "Z");
    const days = Math.floor((Date.now() - confirmedAt) / 86400000);
    const tokens = computeTokenRange(toPaise(o.total_amount || 0));

    let day = 0;
    if (days >= 1 && o.follow_ups_sent < 2) day = 2;
    else if (days >= 2 && o.follow_ups_sent < 3) day = 3;
    if (!day) continue;

    const vars: Record<string, string | number> = {
      CLIENT_NAME: o.customer_name || "",
      ORDER_ID: o.order_no,
      TOKEN_MIN: formatINR(tokens.minPaise),
    };
    if (day === 3) vars.TOTAL_VALUE = formatINR(toPaise(o.total_amount || 0));

    actions.push({
      kind: "reminder",
      orderId: o.id,
      orderNo: o.order_no,
      phone: o.phone,
      customerId: o.customer_id,
      customerLanguage: o.language || "hindi",
      day,
      templateId: day === 2 ? "T12" : "T13",
      vars,
    });
  }
  return actions;
}

export function markReminderSent(orderId: string, day: number): void {
  getDatabase()
    .prepare(`UPDATE orders SET follow_ups_sent = ?, last_followup_at = datetime('now') WHERE id = ?`)
    .run(day, orderId);
}

/** Orders past their token deadline with no confirmed payment → auto-cancel. */
export function computeDueCancellations(): DunningAction[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT o.*, c.phone, c.language, c.name AS customer_name FROM orders o JOIN customers c ON o.customer_id = c.id
       WHERE o.status IN ('order_confirmed','awaiting_token')
         AND o.token_deadline IS NOT NULL
         AND datetime('now') > datetime(o.token_deadline)`
    )
    .all() as Array<OrderRow & { phone: string; language: string; customer_name: string }>;

  const actions: DunningAction[] = [];
  for (const o of rows) {
    if (hasConfirmedPayment(o.id)) continue;
    const internalMessage =
      `Order ${o.order_no} AUTO-CANCELLED — ${o.customer_name} — no token in ${getPaymentPolicy().cancellationWindowDays} days. ` +
      `Client flagged for full advance. (Puneet → Dev → Manager)`;
    actions.push({
      kind: "cancel",
      orderId: o.id,
      orderNo: o.order_no,
      phone: o.phone,
      customerId: o.customer_id,
      customerLanguage: o.language || "hindi",
      templateId: "T15",
      vars: {
        CLIENT_NAME: o.customer_name || "",
        ORDER_ID: o.order_no,
        TOTAL_VALUE: formatINR(toPaise(o.total_amount || 0)),
      },
      internalMessage,
    });
  }
  return actions;
}

/**
 * Execute an auto-cancellation: cancel the order, log the cancellation tracker
 * row (Guidelines §13.2), and flag the client (§13.3). Idempotent per order.
 */
export function executeCancellation(orderId: string, reason = "non_payment", cancelledBy = "Auto (system)"): void {
  const db = getDatabase();
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as OrderRow | undefined;
  if (!o || o.status === "cancelled") return;
  const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(o.customer_id) as Record<string, any>;

  const confirmedAt = o.confirmed_at ? new Date(o.confirmed_at + "Z").getTime() : Date.parse(o.created_at + "Z");
  const daysElapsed = (Date.now() - confirmedAt) / 86400000;
  const totalPaise = toPaise(o.total_amount || 0);
  const tokens = computeTokenRange(totalPaise);

  const tx = db.transaction(() => {
    advanceOrder(orderId, "cancelled", { actor: cancelledBy, note: `Auto-cancelled: ${reason}` });
    db.prepare(
      `INSERT INTO cancellations
        (id, order_id, customer_id, customer_name, customer_phone, spec, order_value_paise,
         token_min_paise, token_max_paise, confirmed_at, days_elapsed, follow_ups_sent, reason, cancelled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      orderId,
      o.customer_id,
      cust?.name || null,
      cust?.phone || null,
      `${o.size_inches}" ${o.grammage}g ${o.quality} ${o.color} ${o.lamination} ${o.quantity_kg}kg`,
      totalPaise,
      tokens.minPaise,
      tokens.maxPaise,
      o.confirmed_at || null,
      Math.round(daysElapsed * 10) / 10,
      o.follow_ups_sent,
      reason,
      cancelledBy
    );
    // Flag the client (reversible only by hierarchy).
    db.prepare(
      `UPDATE customers SET credit_flag = 1, credit_flag_reason = ?, payment_behaviour = 'Flagged' WHERE id = ?`
    ).run(`Order ${o.order_no} cancelled — ${reason}`, o.customer_id);
    db.prepare(`UPDATE enquiries SET status = 'cancelled' WHERE id = ?`).run(o.enquiry_id || "");
  });
  tx();

  appendTimeline(
    o.customer_id,
    orderId,
    "order_cancelled",
    `Order ${o.order_no} auto-cancelled (${reason}). Client flagged for full advance.`,
    cancelledBy
  );
}

/** Lift a credit flag — hierarchy only (Guidelines §13.3). */
export function clearCreditFlag(customerId: string, by: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE customers SET credit_flag = 0, credit_flag_reason = NULL, payment_behaviour = 'unknown' WHERE id = ?`).run(customerId);
  db.prepare(
    `INSERT INTO approvals (id, entity_type, entity_id, action, approver, approver_role, stamp) VALUES (?, 'credit_flag', ?, 'cleared', ?, 'hierarchy', ?)`
  ).run(crypto.randomUUID(), customerId, by, `Credit flag cleared by ${by}`);
}
