import { sarvamChat } from "../sarvam";

export interface BoxSpecs {
  length: number | null;
  width: number | null;
  depth: number | null;
  flute: "Single Wall" | "Double Wall" | null;
  print: "Plain" | "Printed" | null;
  quantity: number | null;
}

export function extractBoxSpecs(text: string, currentSpecs: Partial<BoxSpecs> = {}): Partial<BoxSpecs> {
  const lower = text.toLowerCase();
  const specs = { ...currentSpecs };

  // Dimensions (L x W x D) e.g., 12x8x4
  const dimMatch = text.match(/(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)/);
  if (dimMatch) {
    specs.length = parseInt(dimMatch[1]);
    specs.width = parseInt(dimMatch[2]);
    specs.depth = parseInt(dimMatch[3]);
  }

  // Flute
  if (/\b(?:single|3\s*ply)\b/i.test(lower)) specs.flute = "Single Wall";
  if (/\b(?:double|5\s*ply)\b/i.test(lower)) specs.flute = "Double Wall";

  // Print
  if (/\b(?:print|printed|logo|color)\b/i.test(lower)) specs.print = "Printed";
  if (/\b(?:plain|no\s*print|blank)\b/i.test(lower)) specs.print = "Plain";

  // Quantity
  const qtyMatch = text.match(/(\d+)\s*(?:boxes|pcs|pieces)?/i);
  // Need to be careful not to match dimensions as quantity
  if (qtyMatch && !text.includes(qtyMatch[1] + "x") && !text.includes(qtyMatch[1] + "*")) {
    const q = parseInt(qtyMatch[1]);
    if (q > 50 && q < 100000) specs.quantity = q;
  }

  return specs;
}

export function calculateBoxPrice(specs: BoxSpecs) {
  // Mock pricing logic for corrugated boxes
  if (!specs.length || !specs.width || !specs.depth || !specs.quantity) throw new Error("Missing dims or qty");
  
  // Surface area in sq inches
  const area = (specs.length * specs.width * 2) + (specs.length * specs.depth * 2) + (specs.width * specs.depth * 2);
  
  let basePricePerSqIn = 0.015; // single wall plain
  if (specs.flute === "Double Wall") basePricePerSqIn += 0.01;
  if (specs.print === "Printed") basePricePerSqIn += 0.005;

  const unitPrice = area * basePricePerSqIn;
  // Volume discount
  let discount = 1;
  if (specs.quantity > 1000) discount = 0.95;
  if (specs.quantity > 5000) discount = 0.90;

  const finalUnitPrice = Math.round(unitPrice * discount * 100) / 100;
  const totalAmount = finalUnitPrice * specs.quantity;

  return { unitPrice: finalUnitPrice, totalAmount };
}

export async function processSalesIntent(text: string, currentSpecs: Partial<BoxSpecs> = {}) {
  const specs = extractBoxSpecs(text, currentSpecs);
  
  const hasFullSpecs = !!(specs.length && specs.width && specs.depth && specs.flute && specs.print && specs.quantity);
  let response = "";
  let stage = "gathering_specs";

  if (hasFullSpecs) {
    try {
      const price = calculateBoxPrice(specs as BoxSpecs);
      response = `Great! Your custom corrugated boxes (${specs.length}x${specs.width}x${specs.depth} inches, ${specs.flute}, ${specs.print}) will cost ₹${price.unitPrice} per box.\nTotal for ${specs.quantity} boxes is ₹${Math.round(price.totalAmount).toLocaleString('en-IN')}.\n\nShall we proceed with this order?`;
      stage = "quoting";
    } catch (e) {
      response = "Got your specs, but I'm having trouble calculating the price right now.";
    }
  } else {
    const missing = [];
    if (!specs.length || !specs.width || !specs.depth) missing.push("dimensions (L x W x D in inches)");
    if (!specs.flute) missing.push("thickness (Single Wall or Double Wall)");
    if (!specs.print) missing.push("printing (Plain or Printed)");
    if (!specs.quantity) missing.push("quantity");

    // Fetch coaching rules
    const { getDatabase } = await import("../database");
    const db = getDatabase();
    const rules = db.prepare("SELECT value FROM knowledge_base WHERE type = 'rule'").all() as any[];
    const coachingRulesText = rules.length > 0 
      ? rules.map(r => "- " + r.value).join("\n") 
      : "- (No specific coaching rules yet)";

    const { SALES_AGENT_PROMPT } = await import("../prompts");
    const systemPrompt = SALES_AGENT_PROMPT.replace("{COACHING_RULES}", coachingRulesText)
      + `\n\nCURRENT STATUS:\nThe customer wants to buy boxes. You need: ${missing.join(", ")}.\nAsk the customer politely for the missing information in 1 short sentence.`;
    
    const completion = await sarvamChat([{ role: "system", content: systemPrompt }, { role: "user", content: text }]);
    response = completion.content || `Could you please provide: ${missing.join(", ")}?`;
  }

  return { response, specs, stage };
}
