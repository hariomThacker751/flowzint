import { pctOfPaise } from "../money";
import { getTaxConfig } from "./policy";

/**
 * GST determination (Implementation Spec §1.3).
 *
 *  - Client GSTIN state code == home state (24 = Gujarat) → intra-state →
 *    CGST 9% + SGST 9%.
 *  - Any other state code → inter-state → IGST 18%.
 *  - No/invalid GST (unregistered) → IGST 18% by default (flagged).
 */

export type TaxType = "IGST" | "CGST_SGST";

export type TaxResult = {
  taxType: TaxType;
  stateCode: string | null;
  registered: boolean;
  igstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalTaxPaise: number;
  grandTotalPaise: number;
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/** Extract the 2-digit state code from a GSTIN, or null if malformed/empty. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim().toUpperCase();
  const code = trimmed.slice(0, 2);
  if (!/^[0-9]{2}$/.test(code)) return null;
  return code;
}

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin) return false;
  return GSTIN_RE.test(gstin.trim().toUpperCase());
}

export function computeTax(taxableValuePaise: number, clientGstin: string | null | undefined): TaxResult {
  const cfg = getTaxConfig();
  const stateCode = stateCodeFromGstin(clientGstin);
  const registered = isValidGstin(clientGstin);

  // Intra-state only when registered AND in the home state.
  const intraState = registered && stateCode === cfg.homeStateCode;

  if (intraState) {
    const cgst = pctOfPaise(taxableValuePaise, cfg.cgstPct);
    const sgst = pctOfPaise(taxableValuePaise, cfg.sgstPct);
    return {
      taxType: "CGST_SGST",
      stateCode,
      registered,
      igstPaise: 0,
      cgstPaise: cgst,
      sgstPaise: sgst,
      totalTaxPaise: cgst + sgst,
      grandTotalPaise: taxableValuePaise + cgst + sgst,
    };
  }

  const igst = pctOfPaise(taxableValuePaise, cfg.igstPct);
  return {
    taxType: "IGST",
    stateCode,
    registered,
    igstPaise: igst,
    cgstPaise: 0,
    sgstPaise: 0,
    totalTaxPaise: igst,
    grandTotalPaise: taxableValuePaise + igst,
  };
}
