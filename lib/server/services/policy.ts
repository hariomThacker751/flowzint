import { getDatabase } from "../database";
import { pctOfPaise, roundToNearest10Rupees } from "../money";

/**
 * Policy / configuration service — the single source of truth that replaces
 * the hardcoded "50% advance" literals and scattered tax/company constants.
 * All values come from the `app_config` table (seeded in database.ts).
 */

function get(key: string, fallback: string): string {
  const row = getDatabase().prepare(`SELECT value FROM app_config WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

function getNum(key: string, fallback: number): number {
  const n = Number(get(key, String(fallback)));
  return Number.isFinite(n) ? n : fallback;
}

export function setConfig(key: string, value: string): void {
  getDatabase()
    .prepare(
      `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(key, value);
}

export type PaymentPolicy = {
  tokenMinPct: number;
  tokenMaxPct: number;
  cancellationWindowDays: number;
};

export function getPaymentPolicy(): PaymentPolicy {
  return {
    tokenMinPct: getNum("payment.token_min_pct", 10),
    tokenMaxPct: getNum("payment.token_max_pct", 25),
    cancellationWindowDays: getNum("payment.cancellation_window_days", 3),
  };
}

/** Token min/max in integer paise, rounded to nearest ₹10 (Impl Spec §1.2). */
export function computeTokenRange(grandTotalPaise: number): { minPaise: number; maxPaise: number } {
  const p = getPaymentPolicy();
  return {
    minPaise: roundToNearest10Rupees(pctOfPaise(grandTotalPaise, p.tokenMinPct)),
    maxPaise: roundToNearest10Rupees(pctOfPaise(grandTotalPaise, p.tokenMaxPct)),
  };
}

export type TaxConfig = {
  igstPct: number;
  cgstPct: number;
  sgstPct: number;
  homeStateCode: string;
};

export function getTaxConfig(): TaxConfig {
  return {
    igstPct: getNum("tax.igst_pct", 18),
    cgstPct: getNum("tax.cgst_pct", 9),
    sgstPct: getNum("tax.sgst_pct", 9),
    homeStateCode: get("tax.home_state_code", "24"),
  };
}

export type CompanyConfig = {
  name: string;
  gstin: string;
  hsnPpBox: string;
  bankBlock: string;
  upiDetails: string;
  internalGroupPhone: string;
  invoiceValidityDays: number;
};

export function getCompanyConfig(): CompanyConfig {
  return {
    name: get("company.name", "FLOWZINT INTERWEAVE"),
    gstin: get("company.gstin", "24ABJFA5190P1ZZ"),
    hsnPpBox: get("invoice.hsn_pp_box", "54071000"),
    bankBlock: get("company.bank_block", ""),
    upiDetails: get("company.upi_details", ""),
    internalGroupPhone: get("company.internal_group_phone", ""),
    invoiceValidityDays: getNum("invoice.validity_days", 3),
  };
}
