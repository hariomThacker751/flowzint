import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  normalizeIndicDigits,
  extractSpecs,
  detectIntent,
} from "@/lib/server/unified-agent";

/**
 * Characterization (golden-master) tests for the agent's deterministic NLU.
 *
 * These capture the CURRENT behavior of the language/spec/intent helpers so the
 * planned 4c refactor (extracting them into `lib/server/agent/*`) can be proven
 * to change NOTHING. They use only pure functions — no LLM, no DB, no network.
 */

describe("detectLanguage", () => {
  it("English", () => expect(detectLanguage("I want 500 kg box")).toBe("english"));
  it("Hindi (Devanagari script)", () => expect(detectLanguage("मुझे ३० इंच चाहिए")).toBe("hindi"));
  it("Gujarati (script)", () => expect(detectLanguage("મારે ફેબ્રિક જોઈએ")).toBe("gujarati"));
  it("Tamil (script)", () => expect(detectLanguage("எனக்கு துணி வேண்டும்")).toBe("tamil"));
  it("Gujlish (roman markers)", () => expect(detectLanguage("mane box joiye chhe")).toBe("gujlish"));
  it("Hinglish (roman markers)", () => expect(detectLanguage("mujhe rate batao")).toBe("hinglish"));
  it("Marathi-roman (roman markers)", () => expect(detectLanguage("mala box pahije aahe")).toBe("marathi-roman"));
});

describe("normalizeIndicDigits", () => {
  it("Devanagari → ASCII", () => expect(normalizeIndicDigits("३०")).toBe("30"));
  it("Gujarati decimal → ASCII", () => expect(normalizeIndicDigits("૩.૫")).toBe("3.5"));
  it("ASCII passthrough", () => expect(normalizeIndicDigits("abc 12")).toBe("abc 12"));
});

describe("extractSpecs", () => {
  it("full English spec", () => {
    expect(extractSpecs("36 inch 3.5 gram Silver laminated 500 kg")).toMatchObject({
      sizeInches: 36,
      grammage: 3.5,
      quality: "Silver",
      lamination: "Regular",
      quantityKg: 500,
    });
  });

  it("full colored + unlaminated + tonnes + gold", () => {
    expect(extractSpecs("24 inch full colored unlaminated 1000kg gold")).toMatchObject({
      sizeInches: 24,
      color: "Full Colored",
      lamination: "None",
      quantityKg: 1000,
      quality: "Gold",
    });
  });

  it("tonnes convert to kg; grammage snaps to supported", () => {
    expect(extractSpecs("2 ton 4 gramage")).toMatchObject({ grammage: 4.0, quantityKg: 2000 });
  });

  it("Indic numerals + Devanagari units", () => {
    expect(extractSpecs("३० इंच ४ ग्राम")).toMatchObject({ sizeInches: 30, grammage: 4.0 });
  });
});

describe("detectIntent", () => {
  it("new order", () => expect(detectIntent("I want to place a new order", false)).toBe("new_order"));
  it("repeat order", () => expect(detectIntent("repeat my last order", false)).toBe("repeat_order"));
  it("order status", () => expect(detectIntent("what's the status of my order", false)).toBe("order_status"));
  it("provide GST", () => expect(detectIntent("24ABJFA5190P1Z5 is my gst", false)).toBe("provide_gst"));
  it("confirm order", () => expect(detectIntent("haan", false)).toBe("confirm_order"));
  it("order specs", () => expect(detectIntent("36 inch 3.5 gram silver", false)).toBe("order_specs"));
  it("greeting", () => expect(detectIntent("hello", false)).toBe("greeting"));
});
