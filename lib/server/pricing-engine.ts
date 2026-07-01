import { getDatabase } from "./database";
import { lineTotalPaise, toRupees } from "./money";

export type PricingInput = {
  sizeInches: number;
  grammage: number;
  quality: string;
  color: string;
  lamination: string;
  quantityKg: number;
};

export type PricingResult = {
  basePrice: number;
  qualityUsed: string;
  sizePremium: number;
  grammageAdjustment: number;
  colorPremium: number;
  laminationPremium: number;
  unitPrice: number; // ₹/kg, ex-factory, 2dp
  totalAmount: number; // ₹, ex-factory (taxable value), 2dp
  totalPaise: number; // exact taxable value in paise
  // Governance metadata (used by the quoting gate; never sent to clients):
  basePriceDate: string | null;
  basePriceIsToday: boolean;
  requiresEscalation: boolean;
  escalationReasons: string[];
};

const QUALITY_COLUMN_MAP: Record<string, string> = {
  janta: "base_price_janta",
  regular: "base_price_regular",
  silver: "base_price_silver",
  gold: "base_price_gold",
  platinum: "base_price_platinum",
};

export function getQualityColumn(quality: string): string {
  return QUALITY_COLUMN_MAP[quality.toLowerCase()] || "base_price_3g";
}

/**
 * Exact size-premium table (Guidelines §2.1, "Size Range" table).
 *   12" & 15" → +₹15   16" & 17" → +₹10   19" → +₹1   everything else → 0
 * NOTE: this is a precise lookup, not a range — 13" and 14" carry NO premium
 * (the previous range-based code over-charged them).
 */
function sizePremiumFor(sizeInches: number): number {
  if (sizeInches === 12 || sizeInches === 15) return 15;
  if (sizeInches === 16 || sizeInches === 17) return 10;
  if (sizeInches === 19) return 1;
  return 0;
}

/** Grammage price differential (Guidelines §3 / denier table). */
function grammageAdjustmentFor(grammage: number): number {
  if (grammage >= 3.0 && grammage < 4.0) return 0; // 3.0–3.75g: base
  if (grammage >= 4.0 && grammage < 5.0) return -1; // 4.0–4.75g: base − 1
  if (grammage >= 5.0 && grammage < 6.0) return -2; // 5.0–5.75g: base − 2
  return 0; // out-of-KB grammages → escalate (handled below), no adjustment guessed
}

function colorPremiumFor(color: string): number {
  const c = color.toLowerCase().replace(/_/g, " ");
  if (c.includes("full") && (c.includes("colour") || c.includes("color"))) return 7;
  if (c.includes("half") || c.includes("chequer") || c.includes("checker") || c.includes("colour") || c.includes("color"))
    return 5;
  return 0;
}

function laminationPremiumFor(lamination: string): number {
  const l = lamination.toLowerCase();
  if (l.includes("natural")) return 5;
  if (l.includes("regular") || l === "laminated") return 2;
  return 0;
}

/** Today's base-price row (by effective_date), or null if not set today. */
export function getTodaysBasePriceRow(): Record<string, any> | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT * FROM price_config WHERE date(effective_date) = date('now','localtime')
       ORDER BY effective_date DESC LIMIT 1`
    )
    .get() as Record<string, any> | undefined;
  return row ?? null;
}

export function calculatePrice(input: PricingInput): PricingResult {
  const db = getDatabase();

  const todays = getTodaysBasePriceRow();
  const priceConfig =
    todays ??
    (db.prepare(`SELECT * FROM price_config ORDER BY effective_date DESC LIMIT 1`).get() as
      | Record<string, any>
      | undefined);

  if (!priceConfig) throw new Error("No base price configured");

  const qualityColumn = getQualityColumn(input.quality);
  let basePrice = Number(priceConfig[qualityColumn]) || 0;
  const qualityUsed = basePrice > 0 ? input.quality : "3g (fallback)";
  if (basePrice === 0) basePrice = Number(priceConfig.base_price_3g) || 0;

  const sizePremium = sizePremiumFor(input.sizeInches);
  const grammageAdjustment = grammageAdjustmentFor(input.grammage);
  const colorPremium = colorPremiumFor(input.color);
  const laminationPremium = laminationPremiumFor(input.lamination);

  const unitPriceRaw = basePrice + sizePremium + grammageAdjustment + colorPremium + laminationPremium;
  const unitPrice = Math.round(unitPriceRaw * 100) / 100;
  const totalPaise = lineTotalPaise(unitPrice, input.quantityKg);

  // Escalation governance (Guidelines §2.1/§2.5/§8). Pricing never *blocks* —
  // it reports; the quoting gate decides. Reasons are internal-only.
  const escalationReasons: string[] = [];
  if (input.sizeInches < 22) escalationReasons.push("size_below_22");
  if (input.grammage < 3.0 || input.grammage >= 6.0) escalationReasons.push("grammage_outside_kb");
  // NOTE: natural LAMINATION is a standard +₹5/kg product and is NOT an
  // escalation reason. Only natural BOX (handled in services/escalation.ts
  // via message intent) requires approval.

  return {
    basePrice,
    qualityUsed,
    sizePremium,
    grammageAdjustment,
    colorPremium,
    laminationPremium,
    unitPrice,
    totalAmount: toRupees(totalPaise),
    totalPaise,
    basePriceDate: priceConfig.effective_date ?? null,
    basePriceIsToday: Boolean(todays),
    requiresEscalation: escalationReasons.length > 0,
    escalationReasons,
  };
}

export function saveQuote(enquiryId: string, customerId: string, pricing: PricingResult): string {
  const db = getDatabase();
  const quoteId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO quotes (
      id, enquiry_id, customer_id, base_price, size_premium,
      color_premium, lamination_premium, grammage_adjustment,
      unit_price, total_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    quoteId,
    enquiryId,
    customerId,
    pricing.basePrice,
    pricing.sizePremium,
    pricing.colorPremium,
    pricing.laminationPremium,
    pricing.grammageAdjustment,
    pricing.unitPrice,
    pricing.totalAmount
  );

  return quoteId;
}
