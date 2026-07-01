import { getDatabase } from "./database";
import { appendLog } from "./store";
import { getProductionSpeed } from "./production-speeds";

// ── Corrugator Capacity Model ──────────────────────────────────────────────────────
// 45 identical corrugators total. Each corrugator's daily output depends on the box spec
// being run (see production-speeds.ts: 12" ≈ 86 kg/day, 36" ≈ 172 kg/day, etc.).
//
// DIGITAL TWIN: the owner controls how many corrugators are FREE for system orders via
// the corrugator_floor_config table. If he takes an external (offline) order, he tells
// Director and the "corrugators_external" / "corrugators_available" counts update. ALL capacity,
// feasibility, ETA, and dispatch math below derives from these live numbers —
// so the agent behaves exactly like the owner tracking his own floor.

export const TOTAL_LOOMS = 45;
export const KG_PER_LOOM_PER_DAY = 150;
export const WORKING_DAYS_PER_MONTH = 30;
export const MAX_MONTHLY_CAPACITY_KG = TOTAL_LOOMS * KG_PER_LOOM_PER_DAY * WORKING_DAYS_PER_MONTH; // 202,500

// ── Corrugator Floor Config (owner-controllable digital twin) ──────────────────────

export type CorrugatorFloorConfig = {
  total_corrugators: number;
  corrugators_available: number;        // FREE for new system orders right now
  corrugators_maintenance: number;      // out for repair / breakdown
  corrugators_external: number;         // busy with non-system (offline) orders
  corrugators_in_system: number;        // allocated to system orders (derived)
  updated_by: string;
  notes: string | null;
  updated_at: string;
};

export function getCorrugatorFloorConfig(): CorrugatorFloorConfig {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM corrugator_floor_config WHERE key = 'floor'").get() as {
    total_corrugators: number;
    corrugators_available: number;
    corrugators_maintenance: number;
    corrugators_external: number;
    updated_by: string;
    notes: string | null;
    updated_at: string;
  } | undefined;

  const total = row?.total_corrugators ?? TOTAL_LOOMS;
  const available = row?.corrugators_available ?? total;
  const maint = row?.corrugators_maintenance ?? 0;
  const external = row?.corrugators_external ?? 0;
  const inSystem = Math.max(0, total - available - maint - external);

  return {
    total_corrugators: total,
    corrugators_available: available,
    corrugators_maintenance: maint,
    corrugators_external: external,
    corrugators_in_system: inSystem,
    updated_by: row?.updated_by ?? "system",
    notes: row?.notes ?? null,
    updated_at: row?.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Update the corrugator floor. The owner/Director can set how many corrugators are free,
 * in maintenance, or busy with external orders. in-system count is derived.
 * total = available + maintenance + external + in_system (auto-balanced).
 */
export function updateCorrugatorFloorConfig(input: {
  corrugators_available?: number;
  corrugators_maintenance?: number;
  corrugators_external?: number;
  updated_by?: string;
  notes?: string;
}): CorrugatorFloorConfig {
  const db = getDatabase();
  const current = getCorrugatorFloorConfig();

  const available = typeof input.corrugators_available === "number"
    ? clampCorrugators(input.corrugators_available)
    : current.corrugators_available;
  const maintenance = typeof input.corrugators_maintenance === "number"
    ? clampCorrugators(input.corrugators_maintenance)
    : current.corrugators_maintenance;
  const external = typeof input.corrugators_external === "number"
    ? clampCorrugators(input.corrugators_external)
    : current.corrugators_external;

  // in_system = total - available - maintenance - external (kept non-negative)
  const inSystem = Math.max(0, current.total_corrugators - available - maintenance - external);

  db.prepare(`
    UPDATE corrugator_floor_config
    SET corrugators_available = ?, corrugators_maintenance = ?, corrugators_external = ?,
        updated_by = ?, notes = ?, updated_at = datetime('now')
    WHERE key = 'floor'
  `).run(
    available,
    maintenance,
    external,
    input.updated_by || "owner",
    input.notes || current.notes,
  );

  appendLog("corrugator_floor_updated", {
    before: current,
    after: { available, maintenance, external, inSystem },
    updatedBy: input.updated_by || "owner",
  }).catch(() => {});

  return {
    total_corrugators: current.total_corrugators,
    corrugators_available: available,
    corrugators_maintenance: maintenance,
    corrugators_external: external,
    corrugators_in_system: inSystem,
    updated_by: input.updated_by || "owner",
    notes: input.notes || current.notes,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Reserve/release corrugators for a system order. Called when an order is booked
 * (reserves) or cancelled/completed (frees). Keeps corrugators_available in sync.
 */
export function reserveCorrugators(count: number, updatedBy = "system") {
  const floor = getCorrugatorFloorConfig();
  const delta = clampCorrugators(count);
  const next = clampCorrugators(floor.corrugators_available - delta);
  return updateCorrugatorFloorConfig({
    corrugators_available: next,
    updated_by: updatedBy,
    notes: `Reserved ${delta} corrugator(s) for system order`,
  });
}

export function freeCorrugators(count: number, updatedBy = "system") {
  const floor = getCorrugatorFloorConfig();
  const delta = clampCorrugators(count);
  const next = clampCorrugators(floor.corrugators_available + delta);
  return updateCorrugatorFloorConfig({
    corrugators_available: next,
    updated_by: updatedBy,
    notes: `Freed ${delta} corrugator(s) — order completed/cancelled`,
  });
}

function clampCorrugators(n: number): number {
  return Math.max(0, Math.min(TOTAL_LOOMS, Math.round(n)));
}

// ── Derived monthly capacity (uses LIVE free corrugators, not hardcoded 45) ────────

/** Monthly capacity the system can actually accept = free corrugators × 150 × 30. */
export function getEffectiveMonthlyCapacityKg(): number {
  const floor = getCorrugatorFloorConfig();
  return floor.corrugators_available * KG_PER_LOOM_PER_DAY * WORKING_DAYS_PER_MONTH;
}

/** Back-compat constant: keep the name for existing callers but it is now the
 *  theoretical max (all 45 corrugators). Live capacity = getEffectiveMonthlyCapacityKg(). */
export const MONTHLY_CAPACITY_KG = MAX_MONTHLY_CAPACITY_KG;

export type CorrugatorBooking = {
  id: string;
  enquiry_id: string;
  customer_id: string;
  month_key: string;              // "2026-06"
  kg_booked: number;
  kg_per_day: number;
  delivery_estimate_days: number;
  status: "booked" | "in_production" | "completed" | "cancelled";
  payment_confirmed_at: string | null;
  production_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyCapacity = {
  monthKey: string;
  totalKg: number;
  bookedKg: number;
  availableKg: number;
  utilizationPct: number;
  activeBookings: number;
};

export type CorrugatorFeasibility = {
  feasible: boolean;
  monthKey: string | null;        // which month the order fits into
  availableKg: number;
  estimatedDays: number;
  reason?: string;                // why not feasible, if applicable
};

// ── Month key helpers ────────────────────────────────────────────────────────

export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getBookingMonths(): string[] {
  const now = new Date();
  const current = monthKey(now);
  // Next month
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [current, monthKey(next)];
}

export function daysInMonth(monthKeyStr: string): number {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // last day of month = days in month
}

// ── Capacity queries ─────────────────────────────────────────────────────────

export function getMonthlyCapacity(monthKeyStr: string): MonthlyCapacity {
  const db = getDatabase();
  // LIVE capacity = free corrugators × 150 × 30 (drops when owner takes external orders)
  const totalKg = getEffectiveMonthlyCapacityKg();

  const result = db.prepare(`
    SELECT COALESCE(SUM(kg_booked), 0) as bookedKg, COUNT(*) as activeBookings
    FROM corrugator_bookings
    WHERE month_key = ? AND status IN ('booked', 'in_production', 'completed')
  `).get(monthKeyStr) as { bookedKg: number; activeBookings: number };

  const bookedKg = result.bookedKg;
  const availableKg = Math.max(0, totalKg - bookedKg);

  return {
    monthKey: monthKeyStr,
    totalKg,
    bookedKg,
    availableKg,
    utilizationPct: totalKg > 0 ? Math.round((bookedKg / totalKg) * 100) : 0,
    activeBookings: result.activeBookings,
  };
}

export function getAllMonthlyCapacities(): MonthlyCapacity[] {
  return getBookingMonths().map(mk => getMonthlyCapacity(mk));
}

// ── Live ETA & dispatch calculation (Section 11.1) ───────────────────────────

export type EtaEstimate = {
  feasible: boolean;
  freeCorrugators: number;
  perCorrugatorKgDay: number;
  dailyOutputKg: number;
  productionDays: number;          // calendar days to produce the quantity
  dispatchDate: string | null;     // ISO date production completes (dispatch same day)
  alertDate: string | null;        // ISO date 3 days before dispatch (Ravi auto-WhatsApp)
  reason?: string;
};

/**
 * Compute ETA + dispatch date from the LIVE free corrugators and the KB production speed
 * for the given spec. This is the single source of truth for "when can we deliver?"
 * — it reacts to the owner changing the free-corrugator count.
 */
export function calculateEta(
  quantityKg: number,
  boxSpecs?: { sizeInches?: number; grammage?: number; quality?: string }
): EtaEstimate {
  const floor = getCorrugatorFloorConfig();
  const freeCorrugators = floor.corrugators_available;

  let perCorrugatorKgDay = KG_PER_LOOM_PER_DAY;
  if (boxSpecs?.sizeInches && boxSpecs?.grammage && boxSpecs?.quality) {
    const speed = getProductionSpeed(boxSpecs.sizeInches, boxSpecs.grammage, boxSpecs.quality);
    if (speed && speed.kgPerDay > 0) perCorrugatorKgDay = speed.kgPerDay;
  }

  const dailyOutputKg = freeCorrugators * perCorrugatorKgDay;

  if (!quantityKg || quantityKg <= 0 || freeCorrugators <= 0) {
    return {
      feasible: false,
      freeCorrugators,
      perCorrugatorKgDay,
      dailyOutputKg,
      productionDays: 0,
      dispatchDate: null,
      alertDate: null,
      reason: freeCorrugators <= 0
        ? "No free corrugators right now — Trading Desk required."
        : "Invalid quantity.",
    };
  }

  const productionDays = Math.ceil(quantityKg / dailyOutputKg);
  const today = new Date();
  const dispatch = addDays(today, productionDays);
  const alert = addDays(dispatch, -3);

  return {
    feasible: true,
    freeCorrugators,
    perCorrugatorKgDay,
    dailyOutputKg,
    productionDays,
    dispatchDate: dispatch.toISOString().split("T")[0],
    alertDate: alert.toISOString().split("T")[0],
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Feasibility check ────────────────────────────────────────────────────────

export function checkCorrugatorFeasibility(
  quantityKg: number,
  boxSpecs?: { sizeInches?: number; grammage?: number; quality?: string }
): CorrugatorFeasibility {
  if (!quantityKg || quantityKg <= 0) {
    return { feasible: false, monthKey: null, availableKg: 0, estimatedDays: 0, reason: "Invalid quantity" };
  }

  // Daily output is based on the LIVE free corrugators (digital twin), not all 45.
  const floor = getCorrugatorFloorConfig();
  const freeCorrugators = floor.corrugators_available;

  // Per-corrugator speed for the requested spec (from KB), else 150 kg/day average.
  let perCorrugatorKgDay = KG_PER_LOOM_PER_DAY;
  if (boxSpecs?.sizeInches && boxSpecs?.grammage && boxSpecs?.quality) {
    const speed = getProductionSpeed(boxSpecs.sizeInches, boxSpecs.grammage, boxSpecs.quality);
    if (speed && speed.kgPerDay > 0) {
      perCorrugatorKgDay = speed.kgPerDay;
    }
  }
  const dailyCapacity = freeCorrugators * perCorrugatorKgDay;

  // No free corrugators at all → must route to Trading Desk (Guidelines §6)
  if (freeCorrugators <= 0) {
    return {
      feasible: false,
      monthKey: null,
      availableKg: 0,
      estimatedDays: 0,
      reason: `No free corrugators right now (${floor.corrugators_in_system} on system orders, ${floor.corrugators_external} on external orders, ${floor.corrugators_maintenance} in maintenance). Trading Desk must be activated.`,
    };
  }

  const months = getBookingMonths();

  for (const mk of months) {
    const cap = getMonthlyCapacity(mk);
    if (cap.availableKg >= quantityKg) {
      const estimatedDays = Math.ceil(quantityKg / dailyCapacity);
      return {
        feasible: true,
        monthKey: mk,
        availableKg: cap.availableKg,
        estimatedDays,
      };
    }
  }

  // Check if it could fit partially across both months
  const totalAvailable = months.reduce((sum, mk) => sum + getMonthlyCapacity(mk).availableKg, 0);
  if (totalAvailable >= quantityKg) {
    return {
      feasible: true,
      monthKey: months[1],
      availableKg: totalAvailable,
      estimatedDays: Math.ceil(quantityKg / dailyCapacity),
    };
  }

  return {
    feasible: false,
    monthKey: null,
    availableKg: totalAvailable,
    estimatedDays: 0,
    reason: `Need ${quantityKg} kg but only ${totalAvailable} kg available across next 2 months (${freeCorrugators} free corrugators). Trading Desk may be required.`,
  };
}

// ── Booking operations ───────────────────────────────────────────────────────

export function bookCorrugators(
  enquiryId: string,
  customerId: string,
  quantityKg: number
): { booking: CorrugatorBooking | null; success: boolean; error?: string } {
  if (!quantityKg || quantityKg <= 0) {
    return { booking: null, success: false, error: "Invalid quantity" };
  }

  const feasibility = checkCorrugatorFeasibility(quantityKg);
  if (!feasibility.feasible || !feasibility.monthKey) {
    return { booking: null, success: false, error: feasibility.reason || "No capacity available" };
  }

  const db = getDatabase();
  const id = crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO corrugator_bookings (id, enquiry_id, customer_id, month_key, kg_booked, kg_per_day, delivery_estimate_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'booked')
    `).run(id, enquiryId, customerId, feasibility.monthKey, quantityKg, KG_PER_LOOM_PER_DAY, feasibility.estimatedDays);

    const booking = db.prepare("SELECT * FROM corrugator_bookings WHERE id = ?").get(id) as CorrugatorBooking;

    // Reserve corrugators on the digital-twin floor so the free count stays accurate
    const corrugatorsToReserve = estimateCorrugatorsForBooking(quantityKg, KG_PER_LOOM_PER_DAY);
    reserveCorrugators(corrugatorsToReserve, "system");

    appendLog("corrugator_booked", {
      bookingId: id,
      enquiryId,
      customerId,
      monthKey: feasibility.monthKey,
      kgBooked: quantityKg,
      estimatedDays: feasibility.estimatedDays,
      corrugatorsReserved: corrugatorsToReserve,
    }).catch(() => {});

    return { booking, success: true };
  } catch (err) {
    return {
      booking: null,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function releaseBooking(bookingId: string): boolean {
  const db = getDatabase();
  const booking = db.prepare("SELECT * FROM corrugator_bookings WHERE id = ?").get(bookingId) as CorrugatorBooking | undefined;
  const result = db.prepare(`
    UPDATE corrugator_bookings SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND status = 'booked'
  `).run(bookingId);
  // Free the corrugators that were reserved for this booking
  if (result.changes > 0 && booking) {
    const corrugators = estimateCorrugatorsForBooking(booking.kg_booked, booking.kg_per_day);
    freeCorrugators(corrugators, "system");
  }
  return result.changes > 0;
}

export function confirmPayment(bookingId: string): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE corrugator_bookings
    SET status = 'in_production',
        payment_confirmed_at = ?,
        production_started_at = ?,
        updated_at = datetime('now')
    WHERE id = ? AND status = 'booked'
  `).run(now, now, bookingId);
  return result.changes > 0;
}

export function completeBooking(bookingId: string): boolean {
  const db = getDatabase();
  const booking = db.prepare("SELECT * FROM corrugator_bookings WHERE id = ?").get(bookingId) as CorrugatorBooking | undefined;
  const result = db.prepare(`
    UPDATE corrugator_bookings SET status = 'completed', updated_at = datetime('now')
    WHERE id = ? AND status = 'in_production'
  `).run(bookingId);
  // Production done — return the corrugators to the free pool
  if (result.changes > 0 && booking) {
    const corrugators = estimateCorrugatorsForBooking(booking.kg_booked, booking.kg_per_day);
    freeCorrugators(corrugators, "system");
  }
  return result.changes > 0;
}

/**
 * Rough estimate of how many corrugators a booking occupies for its run time.
 * corrugators = ceil(kgBooked / (kgPerDayPerCorrugator × estimatedDays)).
 * Keeps the free-pool tracking directionally correct without per-corrugator slot maps.
 */
function estimateCorrugatorsForBooking(kgBooked: number, kgPerDay: number): number {
  const perDay = kgPerDay > 0 ? kgPerDay : KG_PER_LOOM_PER_DAY;
  const estDays = Math.max(1, Math.ceil((kgBooked || 0) / (perDay * TOTAL_LOOMS)));
  const corrugators = Math.max(1, Math.ceil((kgBooked || 0) / (perDay * estDays)));
  return clampCorrugators(Math.min(corrugators, TOTAL_LOOMS));
}

// ── Booking queries ──────────────────────────────────────────────────────────

export function getMonthlyBookings(monthKeyStr: string): CorrugatorBooking[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT lb.*, c.name as customer_name, c.phone as customer_phone
    FROM corrugator_bookings lb
    LEFT JOIN customers c ON lb.customer_id = c.id
    WHERE lb.month_key = ?
    ORDER BY lb.created_at DESC
  `).all(monthKeyStr) as CorrugatorBooking[];
}

export function getAllBookings(status?: string): CorrugatorBooking[] {
  const db = getDatabase();
  if (status) {
    return db.prepare(`
      SELECT lb.*, c.name as customer_name, c.phone as customer_phone
      FROM corrugator_bookings lb
      LEFT JOIN customers c ON lb.customer_id = c.id
      WHERE lb.status = ?
      ORDER BY lb.created_at DESC
    `).all(status) as CorrugatorBooking[];
  }
  return db.prepare(`
    SELECT lb.*, c.name as customer_name, c.phone as customer_phone
    FROM corrugator_bookings lb
    LEFT JOIN customers c ON lb.customer_id = c.id
    ORDER BY lb.created_at DESC
  `).all() as CorrugatorBooking[];
}

export function getBookingByEnquiry(enquiryId: string): CorrugatorBooking | null {
  const db = getDatabase();
  return (db.prepare("SELECT * FROM corrugator_bookings WHERE enquiry_id = ?").get(enquiryId) as CorrugatorBooking) || null;
}

// ── Corrugator grid (visualization) ────────────────────────────────────────────────

export type CorrugatorGridItem = {
  corrugatorIndex: number;              // 1-45
  status: "available" | "partially_booked" | "fully_booked";
  utilizationPct: number;         // 0-100
};

export function getCorrugatorGrid(monthKeyStr: string): CorrugatorGridItem[] {
  const cap = getMonthlyCapacity(monthKeyStr);
  const kgPerCorrugator = KG_PER_LOOM_PER_DAY * WORKING_DAYS_PER_MONTH; // 4,500 kg/corrugator/month

  // Distribute bookings across corrugators (simple: fill corrugators sequentially)
  const grid: CorrugatorGridItem[] = [];
  const bookedCorrugatorEquivalents = cap.bookedKg / kgPerCorrugator; // e.g., 30.5 corrugators booked

  for (let i = 1; i <= TOTAL_LOOMS; i++) {
    const corrugatorFill = Math.min(1, Math.max(0, bookedCorrugatorEquivalents - (i - 1)));
    grid.push({
      corrugatorIndex: i,
      status: corrugatorFill >= 1 ? "fully_booked" : corrugatorFill > 0 ? "partially_booked" : "available",
      utilizationPct: Math.round(corrugatorFill * 100),
    });
  }

  return grid;
}

