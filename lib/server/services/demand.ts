import { getDatabase } from "../database";
import { type ExtractedDemand } from "./demand-extraction";

/**
 * Demand-intelligence service.
 *
 * One `demand_profile` per customer, merged from three sources:
 *   - DECLARED  — what the customer tells us (extracted from messages).
 *   - DERIVED   — computed from order history (specs, quantity, frequency,
 *                 region, real seasonality). Most signals come from here.
 *   - OWNER     — dashboard corrections (industry tags, notes).
 *
 * The profile feeds the agent's pre-conversation context, the Seasonal Demand
 * dashboard (via materialized `seasonal_demand` aggregates), and future
 * recommendation/forecast models.
 */

export type DemandProfile = Record<string, any>;

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthsToLabel(csv: string | null | undefined): string {
  if (!csv) return "";
  return String(csv)
    .split(",")
    .map((n) => MONTH_NAMES[Number(n.trim())] || "")
    .filter(Boolean)
    .join(", ");
}

export function ensureProfile(customerId: string): DemandProfile {
  const db = getDatabase();
  let row = db.prepare(`SELECT * FROM demand_profile WHERE customer_id = ?`).get(customerId) as DemandProfile | undefined;
  if (!row) {
    db.prepare(`INSERT INTO demand_profile (id, customer_id) VALUES (?, ?)`).run(crypto.randomUUID(), customerId);
    row = db.prepare(`SELECT * FROM demand_profile WHERE customer_id = ?`).get(customerId) as DemandProfile;
  }
  return row;
}

export function getProfile(customerId: string): DemandProfile | null {
  return (getDatabase().prepare(`SELECT * FROM demand_profile WHERE customer_id = ?`).get(customerId) as DemandProfile) ?? null;
}

const DECLARED_SLOTS = ["peak_months", "festival_drivers", "primary_application", "planning_lead_days", "low_months"] as const;

function computeCompleteness(p: DemandProfile): number {
  const filled = DECLARED_SLOTS.filter((k) => p[k] !== null && p[k] !== undefined && String(p[k]).trim() !== "").length;
  return Math.round((filled / DECLARED_SLOTS.length) * 100) / 100;
}

/** Record a raw declared signal and merge its structured fields into the profile. */
export function recordSignal(
  customerId: string,
  kind: string,
  rawText: string,
  language: string,
  extracted: ExtractedDemand,
  source: "agent" | "owner" = "agent"
): void {
  const db = getDatabase();
  ensureProfile(customerId);
  db.prepare(
    `INSERT INTO demand_signals (id, customer_id, kind, raw_text, language, extracted_json, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), customerId, kind, rawText, language, JSON.stringify(extracted), source, extracted.confidence);

  const sets: string[] = [];
  const vals: any[] = [];
  if (extracted.peakMonths.length) { sets.push("peak_months = ?"); vals.push(extracted.peakMonths.join(",")); }
  if (extracted.lowMonths.length) { sets.push("low_months = ?"); vals.push(extracted.lowMonths.join(",")); }
  if (extracted.festivalDrivers) { sets.push("festival_drivers = ?"); vals.push(extracted.festivalDrivers); }
  if (extracted.application) { sets.push("primary_application = ?"); vals.push(extracted.application); }
  if (extracted.industry) { sets.push("industry_segment = ?"); vals.push(extracted.industry); }
  if (extracted.planningLeadDays != null) { sets.push("planning_lead_days = ?"); vals.push(extracted.planningLeadDays); }
  if (sets.length) {
    sets.push("declared_at = datetime('now')", "pending_ask = NULL", "updated_at = datetime('now')");
    db.prepare(`UPDATE demand_profile SET ${sets.join(", ")} WHERE customer_id = ?`).run(...vals, customerId);
    const p = getProfile(customerId)!;
    db.prepare(`UPDATE demand_profile SET declared_completeness = ? WHERE customer_id = ?`).run(computeCompleteness(p), customerId);
    // Mirror peak months onto the customer row for the agent's existing reads.
    if (extracted.peakMonths.length) {
      db.prepare(`UPDATE customers SET peak_months = ? WHERE id = ?`).run(extracted.peakMonths.join(","), customerId);
    }
  }
}

function mode<T>(values: T[]): T | null {
  if (!values.length) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function monthOf(ts: string): number {
  const d = new Date((ts || "").includes("Z") ? ts : ts + "Z");
  return d.getUTCMonth() + 1;
}

/** Derive profile fields from order history. Idempotent; safe to re-run. */
export function deriveProfile(customerId: string): DemandProfile | null {
  const db = getDatabase();
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as any;
  if (!customer) return null;
  ensureProfile(customerId);

  const orders = db
    .prepare(
      `SELECT size_inches, grammage, quality, color, lamination, quantity_kg, created_at, status
       FROM orders WHERE customer_id = ? AND status != 'cancelled' ORDER BY created_at ASC`
    )
    .all(customerId) as any[];

  if (orders.length === 0) {
    db.prepare(`UPDATE demand_profile SET region_state = COALESCE(?, region_state), derived_at = datetime('now') WHERE customer_id = ?`)
      .run(customer.state || null, customerId);
    return getProfile(customerId);
  }

  const qty = orders.map((o) => Number(o.quantity_kg) || 0);
  const totalKg = qty.reduce((a, b) => a + b, 0);
  const avgKg = Math.round(totalKg / orders.length);
  const peakKg = Math.max(...qty);

  // Order frequency: average gap (days) between consecutive orders.
  let freqDays: number | null = null;
  if (orders.length >= 2) {
    let sum = 0;
    for (let i = 1; i < orders.length; i++) {
      sum += (Date.parse(orders[i].created_at + "Z") - Date.parse(orders[i - 1].created_at + "Z")) / 86400000;
    }
    freqDays = Math.round(sum / (orders.length - 1));
  }

  // Real seasonality: top months by order count.
  const monthCounts = new Array(13).fill(0);
  for (const o of orders) monthCounts[monthOf(o.created_at)]++;
  const derivedPeak = monthCounts
    .map((c, m) => ({ m, c }))
    .filter((x) => x.m >= 1 && x.c > 0)
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map((x) => x.m)
    .sort((a, b) => a - b);

  // Buying pattern heuristic.
  const buying = avgKg >= 1000 ? "bulk" : peakKg >= 2 * (avgKg || 1) ? "mixed" : "regular";

  const prefGrade = mode(orders.map((o) => String(o.quality)));
  const prefWidth = mode(orders.map((o) => String(o.size_inches)));
  const prefColour = mode(orders.map((o) => String(o.color)));
  const prefLam = mode(orders.map((o) => String(o.lamination)));
  const prefGram = mode(orders.map((o) => String(o.grammage)));

  db.prepare(
    `UPDATE demand_profile SET
       region_state = ?, buying_pattern = ?, order_frequency_days = ?, repeat_cycle_days = ?,
       avg_order_kg = ?, peak_order_kg = ?, derived_peak_months = ?,
       preferred_grade = ?, preferred_width = ?, preferred_colour = ?, preferred_lamination = ?, preferred_grammage = ?,
       total_orders = ?, total_kg = ?, derived_at = datetime('now'), updated_at = datetime('now')
     WHERE customer_id = ?`
  ).run(
    customer.state || null, buying, freqDays, freqDays,
    avgKg, peakKg, derivedPeak.join(","),
    prefGrade, prefWidth, prefColour, prefLam, prefGram,
    orders.length, totalKg, customerId
  );

  // Keep customers mirror columns in sync for existing reads.
  db.prepare(`UPDATE customers SET typical_order_kg = ?, preferred_grade = ?, preferred_width = ?, preferred_colour = ?, preferred_lamination = ? WHERE id = ?`)
    .run(avgKg, prefGrade, prefWidth, prefColour, prefLam, customerId);

  return getProfile(customerId);
}

/** Derive every customer that has at least one order. */
export function deriveAllProfiles(): number {
  const db = getDatabase();
  const ids = db.prepare(`SELECT DISTINCT customer_id FROM orders`).all() as Array<{ customer_id: string }>;
  let n = 0;
  for (const { customer_id } of ids) { deriveProfile(customer_id); n++; }
  return n;
}

/**
 * Rebuild the materialized `seasonal_demand` aggregates that power the
 * dashboard's four dimensions (client / size / quality / region).
 */
export function rebuildSeasonalAggregates(): { rows: number } {
  const db = getDatabase();
  const ins = db.prepare(
    `INSERT INTO seasonal_demand (id, customer_id, customer_name, state, dimension, dimension_value, peak_months, typical_quantity_kg, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'derived')`
  );

  const topMonths = (rows: Array<{ created_at: string }>): string => {
    const c = new Array(13).fill(0);
    for (const r of rows) c[monthOf(r.created_at)]++;
    return c.map((n, m) => ({ n, m })).filter((x) => x.m >= 1 && x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3).map((x) => x.m).sort((a, b) => a - b).join(",");
  };

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM seasonal_demand WHERE source = 'derived'`).run();
    let rows = 0;

    // Client dimension — declared peak (or derived) + typical qty per customer.
    const profiles = db
      .prepare(
        `SELECT p.*, c.name AS customer_name, c.state FROM demand_profile p JOIN customers c ON p.customer_id = c.id
         WHERE p.total_orders > 0 OR p.peak_months IS NOT NULL`
      )
      .all() as any[];
    for (const p of profiles) {
      ins.run(crypto.randomUUID(), p.customer_id, p.customer_name, p.state, "client",
        p.customer_name, p.peak_months || p.derived_peak_months || "", p.avg_order_kg || null);
      rows++;
    }

    // Size / Quality / Region dimensions — from order timestamps.
    const groupBy = (col: string, dim: string) => {
      const vals = db.prepare(`SELECT DISTINCT ${col} AS v FROM orders WHERE ${col} IS NOT NULL`).all() as Array<{ v: any }>;
      for (const { v } of vals) {
        const rowsForV = db.prepare(`SELECT created_at, quantity_kg FROM orders WHERE ${col} = ?`).all(v) as any[];
        if (!rowsForV.length) continue;
        const avg = Math.round(rowsForV.reduce((a, b) => a + (Number(b.quantity_kg) || 0), 0) / rowsForV.length);
        ins.run(crypto.randomUUID(), null, null, null, dim, String(v), topMonths(rowsForV), avg);
        rows++;
      }
    };
    groupBy("size_inches", "size");
    groupBy("quality", "quality");

    // Region — by customer state.
    const states = db
      .prepare(`SELECT c.state AS v, o.created_at, o.quantity_kg FROM orders o JOIN customers c ON o.customer_id = c.id WHERE c.state IS NOT NULL`)
      .all() as Array<{ v: string; created_at: string; quantity_kg: number }>;
    const byState = new Map<string, Array<{ created_at: string; quantity_kg: number }>>();
    for (const s of states) {
      if (!byState.has(s.v)) byState.set(s.v, []);
      byState.get(s.v)!.push({ created_at: s.created_at, quantity_kg: s.quantity_kg });
    }
    for (const [state, rowsForState] of byState) {
      const avg = Math.round(rowsForState.reduce((a, b) => a + (Number(b.quantity_kg) || 0), 0) / rowsForState.length);
      ins.run(crypto.randomUUID(), null, null, state, "region", state, topMonths(rowsForState), avg);
      rows++;
    }
    return rows;
  });
  const rows = tx();
  return { rows };
}

export function getSeasonalDimension(dimension: string): any[] {
  return getDatabase()
    .prepare(
      `SELECT dimension_value, peak_months, typical_quantity_kg, customer_name, state
       FROM seasonal_demand WHERE dimension = ? ORDER BY dimension_value`
    )
    .all(dimension);
}

/** Concise demand summary injected into Ravi's pre-conversation context. */
export function getDemandSummaryForAgent(customerId: string): string {
  const p = getProfile(customerId);
  if (!p) return "";
  const bits: string[] = [];
  const peak = monthsToLabel(p.peak_months || p.derived_peak_months);
  if (peak) bits.push(`peak demand: ${peak}`);
  if (p.industry_segment) bits.push(`industry: ${p.industry_segment}`);
  if (p.primary_application) bits.push(`use: ${p.primary_application}`);
  if (p.avg_order_kg) bits.push(`typical order: ~${p.avg_order_kg}kg`);
  if (p.buying_pattern) bits.push(`${p.buying_pattern} buyer`);
  if (p.preferred_grade) bits.push(`prefers ${p.preferred_grade}${p.preferred_width ? ` ${p.preferred_width}"` : ""}`);
  return bits.length ? `DEMAND PROFILE: ${bits.join(" · ")}.` : "";
}
