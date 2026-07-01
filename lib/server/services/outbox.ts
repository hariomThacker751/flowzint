import { getDatabase } from "../database";
import {
  renderTemplate,
  positionalParams,
  getChakraTemplateName,
  resolveTemplateLanguage,
} from "./templates";

/**
 * Outbound message pipeline (Phase 4 — audit P1-7).
 *
 * Every templated outbound goes through the outbox: it is rendered in the
 * customer's NATIVE language, queued, sent, and its delivery/read status is
 * tracked. Idempotency via `dedup_key`. Hybrid send (per the agreed strategy):
 *   - if a ChakraHQ template NAME is mapped for (id, language) → send via the
 *     Meta template API with positional params (compliant for outbound/outside
 *     the 24h window);
 *   - otherwise → send the rendered native body as a session text message.
 * The body is always native; English is never substituted.
 */

/** Registry language name → Meta/ChakraHQ language code. */
const META_LANG_CODE: Record<string, string> = {
  English: "en",
  Hindi: "hi",
  Gujarati: "gu",
  Tamil: "ta",
  Telugu: "te",
  Kannada: "kn",
  Malayalam: "ml",
  Marathi: "mr",
};

export type EnqueueInput = {
  phone: string;
  customerId?: string | null;
  templateId: string;
  customerLanguage?: string | null;
  vars?: Record<string, string | number>;
  dedupKey?: string | null;
  scheduledAt?: string | null;
};

export function enqueue(input: EnqueueInput): string | null {
  const db = getDatabase();
  const rendered = renderTemplate(input.templateId, input.customerLanguage, input.vars || {});
  // Block sends that are missing required variables — never ship blanks.
  const blocked = rendered.missingRequiredVars.length > 0;
  const id = crypto.randomUUID();
  try {
    db.prepare(
      `INSERT INTO outbox
        (id, recipient_phone, customer_id, template_id, language, variables_json, rendered_text, channel, status, missing_vars, dedup_key, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'session', ?, ?, ?, COALESCE(?, datetime('now')))`
    ).run(
      id,
      String(input.phone).replace(/[^\d]/g, ""),
      input.customerId || null,
      input.templateId.toUpperCase(),
      rendered.language,
      JSON.stringify(input.vars || {}),
      rendered.text,
      blocked ? "blocked" : "queued",
      blocked ? JSON.stringify(rendered.missingRequiredVars) : null,
      input.dedupKey || null,
      input.scheduledAt || null
    );
    return id;
  } catch (e: any) {
    // Unique dedup_key conflict → already queued/sent; treat as idempotent no-op.
    if (String(e?.message || e).includes("UNIQUE")) return null;
    throw e;
  }
}

/** True if the 24h customer-service window is open (last inbound < 24h ago). */
export function isSessionWindowOpen(customerId: string | null | undefined): boolean {
  if (!customerId) return false;
  const row = getDatabase()
    .prepare(
      `SELECT created_at FROM chat_messages WHERE customer_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1`
    )
    .get(customerId) as { created_at: string } | undefined;
  if (!row) return false;
  return Date.now() - new Date(row.created_at + "Z").getTime() < 24 * 3600 * 1000;
}

async function sendOne(row: any): Promise<{ ok: boolean; channel: string; messageId?: string; error?: string; deferred?: boolean }> {
  const language: string = row.language || resolveTemplateLanguage(null);
  const templateName = getChakraTemplateName(row.template_id, language);

  // Window-aware hybrid send:
  //  - approved ChakraHQ template → template API (deliverable any time).
  //  - else, only send native session text if the 24h window is open.
  //  - else, defer (cannot be delivered yet per Meta policy) without burning a
  //    retry — it will go out once a template is approved or the customer replies.
  if (!templateName && !isSessionWindowOpen(row.customer_id)) {
    return { ok: false, deferred: true, channel: "session", error: "outside_24h_window_no_approved_template" };
  }

  // Lazy-load the transport so the module graph stays free of WhatsApp config
  // until an actual send happens (also keeps unit tests transport-free).
  const { sendSessionMessage, sendTemplateMessage } = await import("../chakra");
  try {
    if (templateName) {
      const vars = row.variables_json ? JSON.parse(row.variables_json) : {};
      const { templateVariables } = positionalParams(row.template_id, language, vars);
      const code = META_LANG_CODE[language] || "hi";
      const res = await sendTemplateMessage(row.recipient_phone, templateName, code, templateVariables);
      const messageId = res?.messages?.[0]?.id || res?.message_id || undefined;
      return { ok: true, channel: "template", messageId };
    }
    const res = await sendSessionMessage(row.recipient_phone, row.rendered_text);
    const messageId = res?.messages?.[0]?.id || res?.message_id || undefined;
    return { ok: true, channel: "session", messageId };
  } catch (e) {
    return { ok: false, channel: templateName ? "template" : "session", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Process queued messages (called by the job runner). Returns counts. */
export async function processOutbox(limit = 50): Promise<{ sent: number; failed: number; deferred: number }> {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM outbox WHERE status = 'queued' AND attempts < max_attempts
         AND datetime(scheduled_at) <= datetime('now') ORDER BY scheduled_at LIMIT ?`
    )
    .all(limit) as any[];

  let sent = 0;
  let failed = 0;
  let deferred = 0;
  for (const row of rows) {
    const result = await sendOne(row);
    if (result.ok) {
      db.prepare(
        `UPDATE outbox SET status = 'sent', channel = ?, chakra_message_id = ?, attempts = ?, sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(result.channel, result.messageId || null, row.attempts + 1, row.id);
      sent++;
    } else if (result.deferred) {
      // Cannot be delivered yet (no window, no approved template). Keep queued;
      // do NOT consume a retry — it goes out once eligible.
      db.prepare(`UPDATE outbox SET last_error = ?, updated_at = datetime('now') WHERE id = ?`).run(result.error || null, row.id);
      deferred++;
    } else {
      const attempts = row.attempts + 1;
      const status = attempts >= row.max_attempts ? "failed" : "queued";
      db.prepare(
        `UPDATE outbox SET status = ?, channel = ?, attempts = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(status, result.channel, attempts, result.error || null, row.id);
      if (status === "failed") failed++;
    }
  }
  return { sent, failed, deferred };
}

/**
 * Enqueue and attempt to send immediately (used by reactive flows that
 * previously called sendSessionMessage directly). Still recorded + tracked.
 * Returns the rendered native text actually used.
 */
export async function sendTemplated(input: EnqueueInput): Promise<{ id: string | null; ok: boolean; text: string; blocked?: boolean; deferred?: boolean }> {
  const rendered = renderTemplate(input.templateId, input.customerLanguage, input.vars || {});
  const id = enqueue(input);
  if (!id) return { id: null, ok: true, text: rendered.text }; // deduped
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM outbox WHERE id = ?`).get(id) as any;
  if (row.status === "blocked") {
    return { id, ok: false, blocked: true, text: rendered.text };
  }
  const result = await sendOne(row);
  if (result.ok) {
    db.prepare(
      `UPDATE outbox SET status='sent', channel=?, chakra_message_id=?, attempts=1, sent_at=datetime('now'), updated_at=datetime('now') WHERE id=?`
    ).run(result.channel, result.messageId || null, id);
  } else if (result.deferred) {
    db.prepare(`UPDATE outbox SET last_error=?, updated_at=datetime('now') WHERE id=?`).run(result.error || null, id);
  } else {
    db.prepare(
      `UPDATE outbox SET status='queued', channel=?, attempts=1, last_error=?, updated_at=datetime('now') WHERE id=?`
    ).run(result.channel, result.error || null, id);
  }
  return { id, ok: result.ok, text: rendered.text, deferred: result.deferred };
}

/** Update delivery state from a ChakraHQ/Meta status webhook. */
export function recordDeliveryStatus(chakraMessageId: string, status: "sent" | "delivered" | "read" | "failed"): boolean {
  const db = getDatabase();
  const res = db
    .prepare(`UPDATE outbox SET status = ?, updated_at = datetime('now') WHERE chakra_message_id = ?`)
    .run(status, chakraMessageId);
  return res.changes > 0;
}
