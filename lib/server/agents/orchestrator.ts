import { processSalesIntent } from "./sales-agent";
import { processSupportIntent } from "./support-agent";
import { processCareIntent } from "./care-agent";
import { getDatabase } from "../database";
import crypto from "node:crypto";

export async function processCustomerMessageUnified(phone: string, name: string, text: string, autoSend: boolean) {
  // Simple rule-based intent router (extremely fast, avoids LLM latency for routing)
  const lower = text.toLowerCase();
  
  let intent = "care"; // default
  
  // Sales triggers
  if (/\b(price|cost|quote|buy|order|inches|flute|boxes|ply|single wall|double wall)\b/.test(lower) || /\d+x\d+/.test(lower)) {
    intent = "sales";
  }
  
  // Support triggers
  if (/\b(where|track|delayed|broken|damaged|wrong|status|missing)\b/.test(lower)) {
    intent = "support";
  }

  let result;
  
  if (intent === "sales") {
    // In a real app, fetch current specs from DB context here
    result = await processSalesIntent(text);
  } else if (intent === "support") {
    result = await processSupportIntent(text, phone);
  } else {
    result = await processCareIntent(text);
  }

  // Record the message and intent in the database for the UI to display
  try {
    const db = getDatabase();
    // Assuming customers table exists and phone is known (upserted before this call in webhook.ts)
    const customer = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone) as any;
    if (customer) {
      db.prepare(`
        INSERT INTO chat_messages (id, customer_id, channel, role, content, metadata)
        VALUES (?, ?, 'customer_whatsapp', 'assistant', ?, ?)
      `).run(crypto.randomUUID(), customer.id, result.response, JSON.stringify({ intent, stage: result.stage }));
    }
  } catch (e) {
    console.error("Failed to log bot response to DB", e);
  }

  return {
    response: result.response,
    escalated: false,
    stage: result.stage,
    intent
  };
}
