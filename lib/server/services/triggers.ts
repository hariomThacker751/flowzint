import { sendTemplated, enqueue, type EnqueueInput } from "./outbox";

/**
 * Trigger registry (Phase 4 review P1).
 *
 * Single source of truth mapping domain EVENTS → template ids. Wiring code fires
 * events by name instead of hardcoding template strings, so the automation map
 * is centralized, auditable, and easy to extend. `fireTrigger` renders the
 * native template and routes through the outbox (window-aware, tracked,
 * required-var-blocked).
 */

export const TRIGGER_MAP = {
  // Prospecting / conversation (hybrid: used for outbound; in-session is LLM)
  cold_intro: "T1",
  indiamart_response: "T2",
  re_engagement: "T3",
  meter_weight: "T6",
  seasonal_pattern_ask: "T5",
  // Quoting / order
  quote_presentation: "T8",
  quote_followup: "T9",
  order_confirmation: "T10",
  // Payment
  token_request_day1: "T11",
  token_reminder_day2: "T12",
  token_reminder_day3: "T13",
  token_received: "T14",
  order_cancelled: "T15",
  // Production / dispatch
  production_started: "T16",
  eta_update: "T17",
  dispatch_alert: "T18",
  transport_confirmed: "T19",
  dispatched: "T20",
  // Escalation holds + resolutions
  sub22_hold: "T24",
  natural_hold: "T25",
  colour_hold: "T26",
  escalation_approved: "T27",
  escalation_declined: "T28",
  // Owner / lifecycle
  seasonal_outbound: "T29",
  quote_reminder: "T30",
  post_delivery: "T31",
} as const;

export type TriggerEvent = keyof typeof TRIGGER_MAP;

export function templateForEvent(event: TriggerEvent): string {
  return TRIGGER_MAP[event];
}

/** Fire a trigger: render the native template + route through the outbox. */
export async function fireTrigger(event: TriggerEvent, ctx: Omit<EnqueueInput, "templateId">) {
  return sendTemplated({ ...ctx, templateId: TRIGGER_MAP[event] });
}

/** Queue a trigger for later delivery (bulk/outbound paths). */
export function queueTrigger(event: TriggerEvent, ctx: Omit<EnqueueInput, "templateId">): string | null {
  return enqueue({ ...ctx, templateId: TRIGGER_MAP[event] });
}
