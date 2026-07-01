/**
 * Money utilities — all monetary math goes through here.
 *
 * Design rules (production money handling):
 *  - Currency amounts that must be exact (invoice totals, taxes, tokens) are
 *    represented as INTEGER PAISE. Never store currency as a float in the DB.
 *  - Per-kg rates remain plain rupee numbers (they can be ₹80, ₹89, etc.) but
 *    line/tax math is done in paise to avoid floating-point drift.
 *  - Rounding rules come from the spec:
 *      • Taxable value / tax amounts → 2 decimal places (paise-exact).
 *      • Token min/max → nearest ₹10  (Guidelines §10, Impl Spec §1.2).
 */

/** Convert a rupee amount (possibly fractional) to integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert integer paise to a rupee number (2dp). */
export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/** Multiply a per-kg rate (rupees) by quantity (kg) and return integer paise. */
export function lineTotalPaise(ratePerKgRupees: number, quantityKg: number): number {
  return Math.round(ratePerKgRupees * quantityKg * 100);
}

/** Apply a percentage to a paise amount, returning integer paise. */
export function pctOfPaise(paise: number, pct: number): number {
  return Math.round((paise * pct) / 100);
}

/** Round a paise amount to the nearest ₹10 (1000 paise). Used for token min/max. */
export function roundToNearest10Rupees(paise: number): number {
  return Math.round(paise / 1000) * 1000;
}

/** Format integer paise as an Indian-grouped rupee string, e.g. 9408000 → "94,080.00". */
export function formatINR(paise: number): string {
  const rupees = toRupees(paise);
  const [whole, frac = "00"] = rupees.toFixed(2).split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace("-", "");
  // Indian grouping: last 3 digits, then groups of 2.
  let out = digits;
  if (digits.length > 3) {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${sign}${out}.${frac}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + " Hundred");
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/**
 * Convert a rupee amount to Indian-system words, e.g.
 *   94080 → "Rupees Ninety Four Thousand Eighty Only"
 *   94080.50 → "Rupees Ninety Four Thousand Eighty and Fifty Paise Only"
 */
export function amountInWords(paise: number): string {
  const totalPaise = Math.round(Math.abs(paise));
  const rupees = Math.floor(totalPaise / 100);
  const paiseRemainder = totalPaise % 100;

  if (rupees === 0 && paiseRemainder === 0) return "Rupees Zero Only";

  const words: string[] = [];
  let n = rupees;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundredsBlock = n;

  if (crore) words.push(threeDigitsToWords(crore) + " Crore");
  if (lakh) words.push(twoDigitsToWords(lakh) + " Lakh");
  if (thousand) words.push(twoDigitsToWords(thousand) + " Thousand");
  if (hundredsBlock) words.push(threeDigitsToWords(hundredsBlock));

  let result = "Rupees " + words.join(" ");
  if (paiseRemainder) {
    result += " and " + twoDigitsToWords(paiseRemainder) + " Paise";
  }
  return result + " Only";
}
