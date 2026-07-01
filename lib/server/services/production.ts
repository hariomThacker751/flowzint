import { getDatabase } from "../database";
import { getProductionSpeed } from "../production-speeds";
import { KG_PER_CORRUGATOR_PER_DAY } from "../corrugator-capacity";
import { advanceOrder, appendTimeline, getOrder, type OrderRow } from "./order";
import { nextSequence } from "./sequence";

/**
 * Production tracking + ETA engine (Implementation Spec §4, Guidelines §11).
 *
 * Source of truth is the DB (`production_batches` + `daily_production`). The
 * production manager enters one number per batch per day (Actual_KG_Today); the
 * ETA engine recomputes cumulative/remaining/%/revised-ETA deterministically.
 * A Google-Sheets adapter can sync rows in when configured (see sheets.ts).
 *
 * Triggers surfaced for the job runner:
 *   - revised ETA shifts > 1 day vs original  → T17 (ETA update)
 *   - batch is 3 days from revised ETA          → T18 (dispatch alert)
 *   - batch reaches 100%                        → ready_dispatch + internal notify
 */

export type BatchRow = {
  id: string;
  batch_no: string;
  order_id: string;
  customer_id: string;
  order_qty_kg: number;
  target_kg_day: number;
  cumulative_kg: number;
  remaining_kg: number;
  pct_complete: number;
  original_eta: string | null;
  revised_eta: string | null;
  eta_status: string;
  dispatch_alert_sent: number;
  status: string;
  [k: string]: any;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** KB production rate (kg/day) for a spec, with a safe corrugator-based fallback. */
export function targetKgPerDay(sizeInches: number, grammage: number, quality: string): number {
  const speed = getProductionSpeed(sizeInches, grammage, quality);
  if (speed && speed.kgPerDay > 0) return speed.kgPerDay;
  return KG_PER_CORRUGATOR_PER_DAY; // 150 kg/day conservative fallback
}

/** Create a production batch when a token is confirmed. Idempotent per order. */
export function createBatchForOrder(orderId: string, corrugatorGroup?: string): BatchRow {
  const db = getDatabase();
  const existing = db.prepare(`SELECT * FROM production_batches WHERE order_id = ?`).get(orderId) as BatchRow | undefined;
  if (existing) return existing;

  const order = getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const target = targetKgPerDay(order.size_inches, order.grammage, order.quality);
  const days = Math.max(1, Math.ceil(order.quantity_kg / target));
  const eta = isoDate(new Date(Date.now() + days * 86400000));
  const id = crypto.randomUUID();
  const batchNo = `B-${String(nextSequence("batch", "all")).padStart(3, "0")}`;

  db.prepare(
    `INSERT INTO production_batches
      (id, batch_no, order_id, customer_id, spec, order_qty_kg, target_kg_day, cumulative_kg,
       remaining_kg, pct_complete, original_eta, revised_eta, eta_status, corrugator_group, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, 'On Track', ?, 'running')`
  ).run(
    id,
    batchNo,
    orderId,
    order.customer_id,
    `${order.size_inches}" ${order.grammage}g ${order.quality} ${order.color} ${order.lamination}`,
    order.quantity_kg,
    target,
    order.quantity_kg,
    eta,
    eta,
    corrugatorGroup || null
  );

  appendTimeline(order.customer_id, orderId, "batch_started", `Batch ${batchNo} started. Target ${target} kg/day. ETA ${eta}.`, "production");
  return db.prepare(`SELECT * FROM production_batches WHERE id = ?`).get(id) as BatchRow;
}

export type EtaRecomputeResult = {
  batch: BatchRow;
  etaShiftedDays: number; // revised vs original (positive = later)
  completed: boolean;
  reachedDispatchWindow: boolean;
};

/**
 * Record a day's actual KG for a batch and recompute the ETA.
 * Returns the deltas the job runner uses to fire T17/T18 / dispatch-ready.
 */
export function recordDailyKg(batchId: string, prodDate: string, actualKg: number, enteredBy: string): EtaRecomputeResult {
  const db = getDatabase();
  const batch = db.prepare(`SELECT * FROM production_batches WHERE id = ?`).get(batchId) as BatchRow | undefined;
  if (!batch) throw new Error(`Batch not found: ${batchId}`);

  db.prepare(
    `INSERT INTO daily_production (id, batch_id, prod_date, actual_kg, entered_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(batch_id, prod_date) DO UPDATE SET actual_kg = excluded.actual_kg, entered_by = excluded.entered_by`
  ).run(crypto.randomUUID(), batchId, prodDate, actualKg, enteredBy);

  const sum = db.prepare(`SELECT COALESCE(SUM(actual_kg),0) AS s FROM daily_production WHERE batch_id = ?`).get(batchId) as { s: number };
  const cumulative = Math.min(sum.s, batch.order_qty_kg);
  const remaining = Math.max(0, batch.order_qty_kg - cumulative);
  const pct = Math.round((cumulative / batch.order_qty_kg) * 10000) / 100;
  const daysRemaining = remaining > 0 ? Math.ceil(remaining / batch.target_kg_day) : 0;
  const revisedEta = isoDate(new Date(Date.now() + daysRemaining * 86400000));

  const original = batch.original_eta ? Date.parse(batch.original_eta) : Date.parse(revisedEta);
  const etaShiftedDays = Math.round((Date.parse(revisedEta) - original) / 86400000);
  const completed = remaining === 0;
  const etaStatus = completed ? "Complete" : etaShiftedDays > 1 ? "Delayed" : "On Track";

  db.prepare(
    `UPDATE production_batches SET cumulative_kg = ?, remaining_kg = ?, pct_complete = ?, revised_eta = ?,
      eta_status = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(cumulative, remaining, pct, revisedEta, etaStatus, completed ? "complete" : "running", batchId);

  // 3-day dispatch window check
  const daysToEta = Math.ceil((Date.parse(revisedEta) - Date.now()) / 86400000);
  const reachedDispatchWindow = !completed && daysToEta <= 3 && batch.dispatch_alert_sent === 0;

  const updated = db.prepare(`SELECT * FROM production_batches WHERE id = ?`).get(batchId) as BatchRow;
  return { batch: updated, etaShiftedDays, completed, reachedDispatchWindow };
}

export function markDispatchAlertSent(batchId: string): void {
  getDatabase().prepare(`UPDATE production_batches SET dispatch_alert_sent = 1 WHERE id = ?`).run(batchId);
}

/** Running batches within 3 days of their revised ETA that haven't alerted yet. */
export function getBatchesNeedingDispatchAlert(): Array<
  BatchRow & { phone: string; language: string; customer_name: string; order_no: string }
> {
  return getDatabase()
    .prepare(
      `SELECT b.*, c.phone, c.language, c.name AS customer_name, o.order_no
       FROM production_batches b
       JOIN customers c ON b.customer_id = c.id
       JOIN orders o ON b.order_id = o.id
       WHERE b.status = 'running' AND b.dispatch_alert_sent = 0
         AND b.revised_eta IS NOT NULL
         AND julianday(b.revised_eta) - julianday('now') <= 3`
    )
    .all() as Array<BatchRow & { phone: string; language: string; customer_name: string; order_no: string }>;
}

/** Completed batches whose order is still in_production (need → ready_dispatch). */
export function getCompletedBatchesPendingReady(): Array<BatchRow & { order_no: string }> {
  return getDatabase()
    .prepare(
      `SELECT b.*, o.order_no FROM production_batches b JOIN orders o ON b.order_id = o.id
       WHERE b.status = 'complete' AND o.status = 'in_production'`
    )
    .all() as Array<BatchRow & { order_no: string }>;
}

/** Move a completed batch's order to ready_dispatch. */
export function markBatchComplete(batchId: string, actor = "production"): void {
  const db = getDatabase();
  const batch = db.prepare(`SELECT * FROM production_batches WHERE id = ?`).get(batchId) as BatchRow | undefined;
  if (!batch) return;
  const order = getOrder(batch.order_id);
  if (order && order.status === "in_production") {
    advanceOrder(batch.order_id, "ready_dispatch", { actor, note: `Batch ${batch.batch_no} complete (100%).` });
  }
}

/** Record dispatch and close the order (Guidelines §11). */
export function recordDispatch(
  orderId: string,
  info: { transporter?: string; vehicleNo?: string; lrNo?: string; qtyKg?: number; actor: string }
): OrderRow {
  const db = getDatabase();
  const order = getOrder(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  db.prepare(
    `INSERT INTO dispatch (id, order_id, transporter, vehicle_no, lr_no, dispatched_qty_kg, dispatched_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(order_id) DO UPDATE SET transporter=excluded.transporter, vehicle_no=excluded.vehicle_no,
       lr_no=excluded.lr_no, dispatched_qty_kg=excluded.dispatched_qty_kg, dispatched_at=datetime('now')`
  ).run(crypto.randomUUID(), orderId, info.transporter || null, info.vehicleNo || null, info.lrNo || null, info.qtyKg ?? order.quantity_kg);

  const updated = advanceOrder(orderId, "dispatched", { actor: info.actor, note: `Dispatched. Vehicle ${info.vehicleNo || "—"}.` });
  return updated;
}
