import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  lineTotalPaise,
  pctOfPaise,
  roundToNearest10Rupees,
  formatINR,
  amountInWords,
} from "@/lib/server/money";

describe("money", () => {
  it("converts rupees <-> paise exactly", () => {
    expect(toPaise(80)).toBe(8000);
    expect(toPaise(89.5)).toBe(8950);
    expect(toRupees(8950)).toBe(89.5);
  });

  it("computes line totals in paise (rate/kg x qty)", () => {
    expect(lineTotalPaise(80, 500)).toBe(4_000_000); // ₹80/kg × 500kg = ₹40,000
  });

  it("computes token min/max (10% / 25%)", () => {
    const total = lineTotalPaise(80, 500); // 4,000,000 paise
    expect(pctOfPaise(total, 10)).toBe(400_000); // ₹4,000
    expect(pctOfPaise(total, 25)).toBe(1_000_000); // ₹10,000
  });

  it("rounds token amounts to the nearest ₹10", () => {
    expect(roundToNearest10Rupees(toPaise(96))).toBe(10_000); // ₹96 -> ₹100
    expect(roundToNearest10Rupees(toPaise(94))).toBe(9_000); // ₹94 -> ₹90
  });

  it("formats INR with Indian digit grouping", () => {
    expect(formatINR(9_408_000)).toBe("94,080.00");
    expect(formatINR(toPaise(100000))).toBe("1,00,000.00");
  });

  it("renders amount in words (Indian system)", () => {
    expect(amountInWords(toPaise(94080))).toBe("Rupees Ninety Four Thousand Eighty Only");
    expect(amountInWords(toPaise(94080.5))).toBe(
      "Rupees Ninety Four Thousand Eighty and Fifty Paise Only",
    );
  });
});
