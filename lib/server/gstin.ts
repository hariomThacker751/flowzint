/**
 * GSTIN validation — structure + state code + official mod-36 checksum.
 *
 * WHY THIS EXISTS
 * The old chat (Flowzint Interweave, 14–15 Jun) showed the agent mishandling GST:
 *   • It accepted "04AABCU9355J121" — position 14 must be 'Z', and the checksum
 *     was never verified, so a typo'd / boxated number was stored as a real
 *     GST and would have produced an incorrect invoice.
 *   • It lectured "the last two digits should be 29 for Gujarat" — nonsense: the
 *     STATE code is the FIRST two digits, and Gujarat is 24, not 29.
 *
 * A GSTIN is 15 chars:
 *   [2 state code][10 PAN][1 entity code][1 'Z' (default)][1 checksum]
 * The 15th char is a check digit over the first 14, using a Luhn-style mod-36
 * algorithm over the alphabet 0-9A-Z (the algorithm the GSTN publishes).
 */

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_BASE = GSTIN_ALPHABET.length; // 36

// Structural shape. Note the mandatory 'Z' in position 14 — this alone would
// have rejected the malformed "04AABCU9355J121" from the old chat.
const GSTIN_STRUCTURE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

// Valid Indian GST state/UT codes: 01–38, plus 97 (other territory) and
// 99 (centre / OIDAR). 38 = Ladakh (added 2020).
function isValidStateCode(code: string): boolean {
  const n = Number(code);
  if (Number.isNaN(n)) return false;
  return (n >= 1 && n <= 38) || n === 97 || n === 99;
}

/** Official GSTIN check-digit over the first 14 characters. */
export function gstinCheckDigit(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const codePoint = GSTIN_ALPHABET.indexOf(first14[i]);
    if (codePoint < 0) return ""; // illegal char → no valid check digit
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / GSTIN_BASE) + (addend % GSTIN_BASE);
    sum += addend;
  }
  const remainder = sum % GSTIN_BASE;
  const checkCodePoint = (GSTIN_BASE - remainder) % GSTIN_BASE;
  return GSTIN_ALPHABET[checkCodePoint];
}

export type GstinCheck =
  | { valid: true; gstin: string; stateCode: string }
  | { valid: false; gstin: string; reason: "format" | "state_code" | "checksum" };

/**
 * Full validation. Normalises case/whitespace, checks structure, state code,
 * then the checksum. Returns a structured result so callers can decide how to
 * respond (we never want to hard-reject something that is actually valid).
 */
export function validateGSTIN(raw: string): GstinCheck {
  const gstin = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");

  if (!GSTIN_STRUCTURE.test(gstin)) {
    return { valid: false, gstin, reason: "format" };
  }
  if (!isValidStateCode(gstin.slice(0, 2))) {
    return { valid: false, gstin, reason: "state_code" };
  }
  if (gstinCheckDigit(gstin.slice(0, 14)) !== gstin[14]) {
    return { valid: false, gstin, reason: "checksum" };
  }
  return { valid: true, gstin, stateCode: gstin.slice(0, 2) };
}

/** Convenience boolean wrapper. */
export function isValidGSTIN(raw: string): boolean {
  return validateGSTIN(raw).valid;
}

/**
 * Pull the first GSTIN-shaped token out of a free-text message and validate it.
 * Returns the candidate even when invalid so the agent can tell the difference
 * between "no GST mentioned" and "a GST was mentioned but looks wrong".
 */
export function extractGSTIN(text: string): GstinCheck | null {
  const m = String(text || "").toUpperCase().match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}/);
  if (!m) return null;
  return validateGSTIN(m[0]);
}
