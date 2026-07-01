import { getDatabase } from "../database";
import { nextSequence } from "./sequence";

/**
 * Order service — the first-class order lifecycle (Guidelines §9).
 *
 * Order state lives here, NOT on customers.stage, so one customer can have
 * many concurrent orders. The conversational stage on the customer row is now
 * only a hint for the agent's next reply; the order is the system of record.
 *
 * Lifecycle (6 spec stages mapped to explicit states):
 *   quote_pending_approval → quote_approved → order_confirmed
 *   → awaiting_token → in_production → ready_dispatch → dispatched
 *   (cancelled is reachable from any pre-production state)
 */

export type OrderStatus =
  | "quote_pending_approval"
  | "quote_approved"
  | "order_confirmed"
  | "awaiting_token"
  | "in_production"
  | "ready_dispatch"
  | "dispatched"
  | "cancelled";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  quote_pending_approval: ["quote_approved", "cancelled"],
  quote_approved: ["order_confirmed", "cancelled"],
  order_confirmed: ["awaiting_token", "cancelled"],
  awaiting_token: ["in_production", "cancelled"],
  in_production: ["ready_dispatch", "cancelled"],
  ready_dispatch: ["dispatched"],
  dispatched: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type OrderSpec = {
  customerId: string;
  enquiryId?: string | null;
  quoteId?: string | null;
  sizeInches: number;
  grammage: number;
  quality: string;
  color: string;
  lamination: string;
  quantityKg: number;
  unitPrice: number;
  totalAmount: number;
};

export type OrderRow = {
  id: string;
  order_no: string;
  customer_id: string;
  status: OrderStatus;
  size_inches: number;
  grammage: number;
  quality: string;
  color: string;
  lamination: string;
  quantity_kg: number;
  unit_price: number;
  total_amount: number;
  [k: string]: any;
};

function allocateOrderNo(): string {
  const year = new Date().getFullYear();
  const seq = nextSequence("order", String(year));
  return `ORD-${year}-${String(seq).padStart(4, "0")}`;
}

export function createOrder(spec: OrderSpec, initialStatus: OrderStatus = "quote_pending_approval"): OrderRow {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const tx = db.transaction(() => {
    const orderNo = allocateOrderNo();
    db.prepare(
      `INSERT INTO orders
        (id, order_no, customer_id, enquiry_id, quote_id, status,
         size_inches, grammage, quality, color, lamination, quantity_kg, unit_price, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      orderNo,
      spec.customerId,
      spec.enquiryId ?? null,
      spec.quoteId ?? null,
      initialStatus,
      spec.sizeInches,
      spec.grammage,
      spec.quality,
      spec.color,
      spec.lamination,
      spec.quantityKg,
      spec.unitPrice,
      spec.totalAmount
    );
    return orderNo;
  });
  const orderNo = tx();
  appendTimeline(spec.customerId, id, "order_created", `Order ${orderNo} created (${specString(spec)}).`, "system");
  return getOrder(id)!;
}

export function getOrder(orderId: string): OrderRow | null {
  return (getDatabase().prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId) as OrderRow) ?? null;
}

export function getOrderByEnquiry(enquiryId: string): OrderRow | null {
  return (
    (getDatabase()
      .prepare(`SELECT * FROM orders WHERE enquiry_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(enquiryId) as OrderRow) ?? null
  );
}

/**
 * Bridge for the existing enquiry-based flow: return the order linked to an
 * enquiry, creating one (from the enquiry + its latest quote) if none exists.
 * Lets the new order aggregate coexist with the current dashboard, which still
 * references enquiries.
 */
export function getOrCreateOrderForEnquiry(
  enquiryId: string,
  initialStatus: OrderStatus = "order_confirmed"
): OrderRow {
  const db = getDatabase();
  const existing = getOrderByEnquiry(enquiryId);
  if (existing) return existing;

  const enq = db.prepare(`SELECT * FROM enquiries WHERE id = ?`).get(enquiryId) as Record<string, any> | undefined;
  if (!enq) throw new Error(`Enquiry not found: ${enquiryId}`);
  const quote = db
    .prepare(`SELECT * FROM quotes WHERE enquiry_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(enquiryId) as Record<string, any> | undefined;

  return createOrder(
    {
      customerId: enq.customer_id,
      enquiryId,
      quoteId: quote?.id ?? null,
      sizeInches: enq.size_inches,
      grammage: enq.grammage,
      quality: enq.quality,
      color: enq.color || "White",
      lamination: enq.lamination || "None",
      quantityKg: enq.quantity_kg,
      unitPrice: quote?.unit_price ?? 0,
      totalAmount: quote?.total_amount ?? 0,
    },
    initialStatus
  );
}

export function getOpenOrdersCount(customerId: string): number {
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status NOT IN ('dispatched','cancelled')`
    )
    .get(customerId) as { n: number };
  return row.n;
}

/**
 * Advance an order to a new status with validation. Returns the updated row.
 * Throws if the transition is not allowed (caller should catch + surface).
 */
export function advanceOrder(
  orderId: string,
  to: OrderStatus,
  meta: { actor?: string; note?: string } = {}
): OrderRow {
  const db = getDatabase();
  const order = getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) {
    throw new Error(`Illegal order transition ${order.status} → ${to}`);
  }

  const stamps: Partial<Record<OrderStatus, string>> = {
    order_confirmed: "confirmed_at",
    cancelled: "cancelled_at",
  };
  const stampCol = stamps[to];
  db.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now')${stampCol ? `, ${stampCol} = datetime('now')` : ""} WHERE id = ?`
  ).run(to, orderId);

  appendTimeline(order.customer_id, orderId, `order_${to}`, meta.note || `Order moved to ${to}.`, meta.actor || "system");
  return getOrder(orderId)!;
}

export function appendTimeline(
  customerId: string,
  orderId: string | null,
  eventType: string,
  description: string,
  triggeredBy: string
): void {
  getDatabase()
    .prepare(
      `INSERT INTO interaction_timeline (id, customer_id, order_id, event_type, description, triggered_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(crypto.randomUUID(), customerId, orderId, eventType, description, triggeredBy);
}

function specString(s: OrderSpec): string {
  return `${s.sizeInches}" ${s.grammage}g ${s.quality} ${s.color} ${s.lamination} ${s.quantityKg}kg`;
}
