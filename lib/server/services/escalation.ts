import { getDatabase } from "../database";
import { approvalStamp, type Role } from "../auth";

/**
 * Escalation rule engine (Guidelines §8 — Human-in-the-Loop gates).
 *
 * These gates are DETERMINISTIC and run BEFORE any price is shown to a client.
 * The agent must hold and route Puneet → Dev → Manager for:
 *   - size below 22"            → T24 holding
 *   - natural BOX (transparent, no/min additives) → T25 holding
 *     (NOTE: natural LAMINATION is a standard +₹5/kg product — NOT escalated)
 *   - non-standard colour       → T26 holding
 *   - non-standard grammage     → hold (outside KB)
 *   - GST/tax or transport query → hold (answered separately)
 *   - any Trading Desk activation → notify hierarchy
 */

export type EscalationTrigger =
  | "size_below_22"
  | "natural_box"
  | "non_standard_colour"
  | "grammage_outside_kb"
  | "tax_query"
  | "transport_query"
  | "trading_desk";

export type EscalationSpecs = {
  sizeInches?: number | null;
  grammage?: number | null;
  color?: string | null;
  lamination?: string | null;
};

const TRIGGER_TEMPLATE: Record<EscalationTrigger, string> = {
  size_below_22: "T24",
  natural_box: "T25",
  non_standard_colour: "T26",
  grammage_outside_kb: "T24", // generic hold
  tax_query: "T24",
  transport_query: "T24",
  trading_desk: "T21",
};

const STANDARD_COLOURS = ["white", "half", "chequer", "checker", "full colour", "full color", "colour", "color"];

export type EscalationDecision = {
  escalate: boolean;
  triggers: EscalationTrigger[];
  holdingTemplate: string | null;
};

/**
 * Pure, deterministic evaluation. `messageText` is the raw client message so we
 * can catch tax/transport intents that aren't expressed as specs.
 */
export function evaluateEscalation(specs: EscalationSpecs, messageText: string = ""): EscalationDecision {
  const triggers: EscalationTrigger[] = [];
  const text = messageText.toLowerCase();

  if (typeof specs.sizeInches === "number" && specs.sizeInches > 0 && specs.sizeInches < 22) {
    triggers.push("size_below_22");
  }

  // NOTE: "natural LAMINATION" is a STANDARD product (a +₹5/kg coating premium)
  // and must NOT be escalated. Only the special "natural BOX" category
  // (transparent, no/minimal additives) requires human approval. We therefore
  // look at the message intent for "natural box"/"transparent", and ignore a
  // lamination value of "Natural".
  if (/\bnatural\s*box\b/.test(text) || /\btransparent\b/.test(text)) {
    triggers.push("natural_box");
  }

  const colour = (specs.color || "").toLowerCase();
  if (colour && !STANDARD_COLOURS.some((c) => colour.includes(c))) {
    triggers.push("non_standard_colour");
  }

  if (typeof specs.grammage === "number" && specs.grammage > 0 && (specs.grammage < 3.0 || specs.grammage >= 6.0)) {
    triggers.push("grammage_outside_kb");
  }

  if (/\b(gst|tax|igst|cgst|sgst|taxation)\b/.test(text)) triggers.push("tax_query");
  if (/\b(transport|freight|delivery charge|carriage|truck fare|lorry)\b/.test(text)) triggers.push("transport_query");

  const unique = Array.from(new Set(triggers));
  return {
    escalate: unique.length > 0,
    triggers: unique,
    holdingTemplate: unique.length > 0 ? TRIGGER_TEMPLATE[unique[0]] : null,
  };
}

// Holding messages now come from the native template registry (T24/T25/T26)
// via renderTemplate() — see unified-agent. The old hand-written 3-language
// fallback was removed because it defaulted regional languages to English.

export function createEscalation(input: {
  customerId: string;
  customerPhone: string;
  customerName?: string;
  orderId?: string;
  triggers: EscalationTrigger[];
  holdingTemplate: string | null;
  holdingMessageText: string;
  question: string;
}): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO pending_escalations
      (id, customer_id, customer_phone, customer_name, order_id, question, holding_message, holding_template, trigger_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    input.customerId,
    input.customerPhone,
    input.customerName || null,
    input.orderId || null,
    input.question,
    input.holdingMessageText,
    input.holdingTemplate,
    input.triggers.join(",")
  );
  return id;
}

export function resolveEscalation(
  escalationId: string,
  decision: { approver: string; approverRole: Role; resolution: string; reply?: string }
): void {
  const db = getDatabase();
  const stamp = approvalStamp("Escalation resolved", decision.approver);
  db.prepare(
    `UPDATE pending_escalations
     SET status = 'resolved', approver = ?, approved_at = datetime('now'), stamp = ?, resolution = ?, owner_reply = ?
     WHERE id = ?`
  ).run(decision.approver, stamp, decision.resolution, decision.reply || null, escalationId);

  db.prepare(
    `INSERT INTO approvals (id, entity_type, entity_id, action, approver, approver_role, stamp, notes)
     VALUES (?, 'escalation', ?, 'resolved', ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), escalationId, decision.approver, decision.approverRole, stamp, decision.resolution);
}
