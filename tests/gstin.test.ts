import { describe, it, expect } from "vitest";
import { validateGSTIN, isValidGSTIN, gstinCheckDigit } from "@/lib/server/gstin";

/** Build a checksum-correct GSTIN from a valid 14-char prefix. */
function makeValidGstin(first14: string): string {
  return first14 + gstinCheckDigit(first14);
}

describe("gstin", () => {
  it("rejects the malformed number from the old chat", () => {
    // "04AABCU9355J121" — wrong length, no mandatory 'Z' at pos 14.
    expect(isValidGSTIN("04AABCU9355J121")).toBe(false);
    expect(validateGSTIN("04AABCU9355J121").valid).toBe(false);
  });

  it("accepts a structurally valid GSTIN with a correct checksum", () => {
    const g = makeValidGstin("24ABJFA5190P1Z"); // Gujarat (state 24)
    const res = validateGSTIN(g);
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.stateCode).toBe("24");
  });

  it("flags a wrong checksum", () => {
    const good = makeValidGstin("24ABJFA5190P1Z");
    const bad = good.slice(0, 14) + (good[14] === "Z" ? "A" : "Z");
    const res = validateGSTIN(bad);
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe("checksum");
  });

  it("flags an invalid state code (00)", () => {
    const res = validateGSTIN(makeValidGstin("00ABJFA5190P1Z"));
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe("state_code");
  });
});
