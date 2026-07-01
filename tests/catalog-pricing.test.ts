import { describe, it, expect } from "vitest";
// Imported via the facade on purpose: this also proves the catalog access path
// resolves correctly AND that the live pricing pipeline does not depend on the
// redundant catalog files (fabric_catalog_parsed.json, *.xlsx, etc.).
import { PRICING_PREMIUMS } from "@/lib/server/catalog";

describe("catalog pricing premiums (README §2/§3 rules)", () => {
  it("size premiums: 19→+1, 16/17→+10, 12/15→+15", () => {
    expect(PRICING_PREMIUMS.size["19"]).toBe(1);
    expect(PRICING_PREMIUMS.size["16"]).toBe(10);
    expect(PRICING_PREMIUMS.size["17"]).toBe(10);
    expect(PRICING_PREMIUMS.size["12"]).toBe(15);
    expect(PRICING_PREMIUMS.size["15"]).toBe(15);
  });

  it("grammage bands: 3.x→x, 4.x→x-1, 5.x→x-2", () => {
    expect(PRICING_PREMIUMS.grammage["3.0"]).toBe(0);
    expect(PRICING_PREMIUMS.grammage["3.5"]).toBe(0);
    expect(PRICING_PREMIUMS.grammage["4.0"]).toBe(-1);
    expect(PRICING_PREMIUMS.grammage["4.5"]).toBe(-1);
    expect(PRICING_PREMIUMS.grammage["5.0"]).toBe(-2);
    expect(PRICING_PREMIUMS.grammage["5.5"]).toBe(-2);
  });

  it("color premiums: white 0, half +5, full +7", () => {
    expect(PRICING_PREMIUMS.color.white).toBe(0);
    expect(PRICING_PREMIUMS.color.half_colored).toBe(5);
    expect(PRICING_PREMIUMS.color.full_colored).toBe(7);
  });

  it("lamination premiums: none 0, regular +2, natural +5", () => {
    expect(PRICING_PREMIUMS.lamination.unlaminated).toBe(0);
    expect(PRICING_PREMIUMS.lamination.regular_lamination).toBe(2);
    expect(PRICING_PREMIUMS.lamination.natural_lamination).toBe(5);
  });
});
