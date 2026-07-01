import { getDatabase } from "./database";
import { lineTotalPaise, toRupees } from "./money";

export type PricingInput = {
  sizeInches: number;
  grammage: number; // Represents paper GSM (e.g. 120, 150, 200). Handles both decimal and integer inputs.
  quality: string;  // Represents Ply Grade (3-Ply, 5-Ply, 7-Ply)
  color: string;    // Represents Printing Type (Plain, Flexo, Offset)
  lamination: string; // Represents Lamination/Finish (None, Regular, UV Coating)
  quantityKg: number; // Represents Box Quantity (in Units / Pieces)
};

export type PricingResult = {
  basePrice: number;
  qualityUsed: string;
  sizePremium: number;
  grammageAdjustment: number;
  colorPremium: number;
  laminationPremium: number;
  unitPrice: number; // ₹/box, ex-factory, 2dp
  totalAmount: number; // ₹, ex-factory (taxable value), 2dp
  totalPaise: number; // exact taxable value in paise
  basePriceDate: string | null;
  basePriceIsToday: boolean;
  requiresEscalation: boolean;
  escalationReasons: string[];
};

export function getQualityColumn(quality: string): string {
  const q = quality.toLowerCase();
  if (q.includes("7")) return "base_price_silver";
  if (q.includes("5")) return "base_price_regular";
  return "base_price_3g";
}

function sizePremiumFor(sizeInches: number): number {
  if (sizeInches <= 20) return 0;
  if (sizeInches <= 40) return 5;
  return 12;
}

function grammageAdjustmentFor(grammage: number): number {
  // If grammage is passed as a small decimal (legacy 3.0-5.0), scale to GSM (150-250)
  const gsm = grammage < 10 ? grammage * 50 : grammage;
  if (gsm <= 120) return 0;
  if (gsm <= 150) return 4;
  return 8;
}

function colorPremiumFor(color: string): number {
  const c = color.toLowerCase();
  if (c.includes("plain") || c === "none") return 0;
  if (c.includes("offset") || c.includes("full") || c.includes("multi")) return 7;
  return 3; // Flexo printing fallback
}

function laminationPremiumFor(lamination: string): number {
  const l = lamination.toLowerCase();
  if (l.includes("none") || l === "") return 0;
  if (l.includes("uv") || l.includes("varnish") || l.includes("natural")) return 6;
  return 4; // Regular film lamination
}

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

  const basePriceConfig = Number(priceConfig.base_price_3g) || 80;
  
  // Base price dynamically scaled from DB configuration
  let basePrice = basePriceConfig * 0.4; // 3-Ply default (₹32)
  const q = input.quality.toLowerCase();
  if (q.includes("7")) {
    basePrice = basePriceConfig * 0.75; // 7-Ply (₹60)
  } else if (q.includes("5")) {
    basePrice = basePriceConfig * 0.563; // 5-Ply (₹45)
  }

  const qualityUsed = q.includes("7") ? "7-Ply" : q.includes("5") ? "5-Ply" : "3-Ply";

  const sizePremium = sizePremiumFor(input.sizeInches);
  const grammageAdjustment = grammageAdjustmentFor(input.grammage);
  const colorPremium = colorPremiumFor(input.color);
  const laminationPremium = laminationPremiumFor(input.lamination);

  const unitPriceRaw = basePrice + sizePremium + grammageAdjustment + colorPremium + laminationPremium;
  const unitPrice = Math.round(unitPriceRaw * 100) / 100;
  
  // quantityKg represents Box Quantity (pieces) in Box OS
  const totalPaise = lineTotalPaise(unitPrice, input.quantityKg);

  // Box Factory Escalation Rules
  const escalationReasons: string[] = [];
  if (q.includes("7")) escalationReasons.push("7_ply_setup_check");
  if (input.quantityKg < 500) escalationReasons.push("low_quantity_short_run");
  if (input.sizeInches > 50) escalationReasons.push("oversized_board_run");

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
