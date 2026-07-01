import crypto from "node:crypto";
import { sendSessionMessage } from "@/lib/server/chakra";
import { getConfig } from "@/lib/server/config";
import { appendLog, getAgentState } from "@/lib/server/store";
import { getDatabase } from "@/lib/server/database";

export function verifyChakraSignature(rawBody: string, signature: string | null) {
  const secret = getConfig().webhookSecret;

  // Fail CLOSED. Previously this returned `true` whenever the signature header
  // was absent, which let anyone drive the agent by simply omitting it. Now: if
  // a secret is configured (required in production) every request must carry a
  // valid HMAC. A missing secret is tolerated only outside production so local
  // dev tunnels still work.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[webhook] CHAKRA_WEBHOOK_SECRET not set — rejecting request in production");
      return false;
    }
    console.warn("[webhook] CHAKRA_WEBHOOK_SECRET not set — signature check skipped (non-production only)");
    return true;
  }
  if (!signature) return false; // secret configured but request unsigned → reject

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalized = signature.replace(/^sha256=/, "");
  const a = Buffer.from(expected);
  const b = Buffer.from(normalized);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractWhatsAppMessage(data: any) {
  const value = data?.entry?.[0]?.changes?.[0]?.value;
  const payload = data?.payload ?? data?.data ?? value ?? data;
  const message =
    payload?.message ??
    payload?.messages?.[0] ??
    data?.message ??
    data?.messages?.[0] ??
    {};
  const contacts = payload?.contacts ?? data?.contacts ?? [];
  const type = message?.type ?? "text";
  let text = "";
  if (type === "text") text = message?.text?.body ?? "";
  if (type === "interactive") {
    text = message?.interactive?.button_reply?.title ?? message?.interactive?.list_reply?.title ?? "";
  }
  if (!text && ["image", "audio", "video", "document"].includes(type)) {
    text = `[${type} received]`;
  }
  return {
    phone: String(message?.from ?? payload?.from ?? payload?.wa_id ?? "").replace(/[^\d]/g, ""),
    name: contacts?.[0]?.profile?.name ?? "",
    type,
    text,
    messageId: payload?.messageId ?? payload?.message_id ?? message?.id ?? "",
  };
}

/**
 * Customer webhook — handles inbound messages from customers
 * Ravi processes and replies
 * 
 * IMPORTANT: Owner phone (if configured) should use the owner webhook endpoint.
 * This webhook only processes customer messages, not owner messages.
 */
export async function handleCustomerInbound(rawBody: string, signature: string | null) {
  if (!verifyChakraSignature(rawBody, signature)) {
    return { status: 401, body: { error: "Invalid signature" } };
  }

  const data = JSON.parse(rawBody || "{}");

  // ── Delivery/read status callbacks → update the outbox (Phase 4) ──────────
  const statuses =
    data?.entry?.[0]?.changes?.[0]?.value?.statuses ?? data?.statuses ?? data?.payload?.statuses ?? null;
  if (Array.isArray(statuses) && statuses.length) {
    try {
      const { recordDeliveryStatus } = await import("@/lib/server/services/outbox");
      for (const s of statuses) {
        const id = s?.id || s?.message_id;
        const status = String(s?.status || "").toLowerCase();
        if (id && ["sent", "delivered", "read", "failed"].includes(status)) {
          recordDeliveryStatus(id, status as "sent" | "delivered" | "read" | "failed");
        }
      }
    } catch (e) {
      await appendLog("chakra_status_update_error", { error: String(e) });
    }
    return { status: 200, body: { status: "status_processed" } };
  }

  // Ignore non-message events
  if (data?.event && !String(data.event).toLowerCase().includes("message")) {
    await appendLog("chakra_event_ignored", { event: data.event });
    return { status: 200, body: { status: "ignored" } };
  }

  const inbound = extractWhatsAppMessage(data);

  // ── Deduplication: ChakraHQ sometimes delivers the same webhook concurrently ──
  if (inbound.messageId) {
    try {
      const db = getDatabase();
      db.prepare(`INSERT INTO processed_webhooks (message_id) VALUES (?)`).run(inbound.messageId);
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        await appendLog("chakra_webhook_duplicate", { messageId: inbound.messageId });
        return { status: 200, body: { status: "duplicate" } };
      }
    }
  }

  await appendLog("customer_inbound", inbound);

  if (!inbound.phone || !inbound.text) {
    return { status: 200, body: { status: "empty" } };
  }

  const ownerPhoneConfig = (process.env.OWNER_PHONE || "").trim();
  const ownerPhones = ownerPhoneConfig
    .split(",")
    .map(p => p.replace(/[^\d]/g, "").trim())
    .filter(Boolean);

  /**
   * Secure owner phone matching:
   * 1. Exact match (both have country code) — highest confidence.
   * 2. Suffix match only when the CONFIGURED phone has ≤10 digits (no country
   *    code stored), meaning we cannot do an exact country-code comparison.
   *    This prevents a spoofing attack where +1 XXXXXXXXXX matches +91 XXXXXXXXXX.
   */
  const isFromOwner = ownerPhones.some(configured => {
    if (configured === inbound.phone) return true; // exact match
    // Only fall back to suffix if the stored number itself has no country code
    if (configured.length <= 10) {
      const inboundSuffix = inbound.phone.slice(-configured.length);
      return inboundSuffix === configured;
    }
    return false; // both have country codes but they differ — reject
  });

  if (isFromOwner) {
    await appendLog("customer_webhook_ignored_owner", {
      reason: "message from owner phone, should be handled by owner webhook",
      phone: inbound.phone,
    });
    return { status: 200, body: { status: "ignored_owner_message" } };
  }

  const state = await getAgentState();
  if (!state.agentEnabled || !state.raviEnabled) {
    await appendLog("ravi_skipped_disabled", { inbound, state });
    return { status: 200, body: { status: "received_agent_disabled" } };
  }

  let result;
  try {
    // Use the new multi-agent orchestrator
    const { processCustomerMessageUnified } = await import("@/lib/server/agents/orchestrator");
    result = await processCustomerMessageUnified(
      inbound.phone,
      inbound.name,
      inbound.text,
      state.autoSendRaviReplies
    );
  } catch (error) {
    await appendLog("ravi_processing_failed", {
      inbound,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return {
    status: 200,
    body: {
      status: state.autoSendRaviReplies ? "replied" : "drafted",
      inbound,
      reply: result.response,
      autoSent: state.autoSendRaviReplies,
      escalated: result.escalated,
      needsOwnerInput: "needsOwnerInput" in result ? result.needsOwnerInput : false,
      questionForOwner: "questionForOwner" in result ? result.questionForOwner : undefined,
      stage: "stage" in result ? result.stage : undefined,
    },
  };
}

/**
 * Owner webhook — handles messages from the business owner
 *
 * Currently: if no OWNER_PHONE is configured, return 200 silently.
 * This prevents double-processing when ChakraHQ fires both webhooks.
 * Owner contacts will be configured separately.
 */
export async function handleOwnerInbound(rawBody: string, signature: string | null) {
  if (!verifyChakraSignature(rawBody, signature)) {
    return { status: 401, body: { error: "Invalid signature" } };
  }

  // If no owner is configured yet, silently acknowledge without processing.
  // This prevents double-replies since ChakraHQ fires both webhooks.
  const ownerPhoneConfig = (process.env.OWNER_PHONE || "").trim();
  if (!ownerPhoneConfig) {
    return { status: 200, body: { status: "no_owner_configured" } };
  }

  const data = JSON.parse(rawBody || "{}");

  // Ignore non-message events
  if (data?.event && !String(data.event).toLowerCase().includes("message")) {
    await appendLog("owner_event_ignored", { event: data.event });
    return { status: 200, body: { status: "ignored" } };
  }

  const inbound = extractWhatsAppMessage(data);

  // ⚠️ CRITICAL: Check if sender is owner BEFORE dedup.
  // If we dedup first and this isn't an owner message, the customer webhook
  // will see the dedup record and skip processing → message is LOST.
  if (!inbound.phone || !inbound.text) {
    return { status: 200, body: { status: "empty" } };
  }

  // Only handle messages FROM the configured owner's phone
  const ownerPhones = ownerPhoneConfig
    .split(",")
    .map(p => p.replace(/[^\d]/g, "").trim())
    .filter(Boolean);

  const isFromOwner = ownerPhones.some(configured => {
    if (configured === inbound.phone) return true;
    if (configured.length <= 10) {
      return inbound.phone.slice(-configured.length) === configured;
    }
    return false;
  });

  if (!isFromOwner) {
    // NOT an owner message — exit WITHOUT dedup so customer webhook can process it
    await appendLog("owner_webhook_not_owner", { reason: "not from owner phone — leaving for customer webhook", from: inbound.phone });
    return { status: 200, body: { status: "not_owner" } };
  }

  // ── Deduplication (only for genuine owner messages) ──
  if (inbound.messageId) {
    try {
      const db = getDatabase();
      db.prepare(`INSERT INTO processed_webhooks (message_id) VALUES (?)`).run(inbound.messageId);
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        await appendLog("chakra_webhook_duplicate", { messageId: inbound.messageId });
        return { status: 200, body: { status: "duplicate" } };
      }
    }
  }

  await appendLog("owner_inbound", inbound);

  const db = getDatabase();

  try {
    const { DirectorAgent } = await import("@/lib/server/director-agent");
    const director = new DirectorAgent();

    const history = await director.getConversationHistory(inbound.phone, 10);
    const result = await director.processOwnerMessage(inbound.phone, inbound.text, history);

    await appendLog("Director_reply", {
      inbound,
      reply: result.reply,
      memoryCandidate: result.memoryCandidate,
    });

    // Check if Director resolved an escalation
    const match = result.reply.match(/RESOLVE_ESCALATION:\s*([a-zA-Z0-9-]+)/);
    let escalationResolved = false;

    if (match) {
      const escalationId = match[1];
      const escalation = db.prepare("SELECT * FROM pending_escalations WHERE id = ?").get(escalationId) as any;
      
      if (escalation && escalation.status === 'pending') {
        let customerReply = result.reply.replace(/RESOLVE_ESCALATION:\s*[a-zA-Z0-9-]+/, "").trim();
        if (customerReply.length < 5) customerReply = inbound.text;

        db.prepare(`
          UPDATE pending_escalations
          SET status = 'resolved', owner_reply = ?, resolved_at = datetime('now')
          WHERE id = ?
        `).run(inbound.text, escalationId);

        escalationResolved = true;

        try {
          const state = await getAgentState();
          if (state.autoSendRaviReplies) {
            await sendSessionMessage(escalation.customer_phone, customerReply);
            const customerRecord = db.prepare("SELECT id FROM customers WHERE phone = ?").get(escalation.customer_phone) as any;
            if (customerRecord) {
              db.prepare(`
                INSERT INTO chat_messages (id, customer_id, channel, role, content)
                VALUES (?, ?, 'customer_whatsapp', 'assistant', ?)
              `).run(crypto.randomUUID(), customerRecord.id, customerReply);
            }
          }
        } catch(e) { console.error("Failed to forward:", e); }

        // Send confirmation to owner
        if (inbound.phone) {
          const confirmMsg = `✅ Forwarded to customer: "${escalation.customer_name}" (+${escalation.customer_phone})\n\nSent: ${customerReply}`;
          await sendSessionMessage(inbound.phone, confirmMsg);
        }
      }
    }

    // Auto-store memory if Director extracted a coaching rule
    if (result.memoryCandidate) {
      await director.storeMemory(
        result.memoryCandidate.key,
        result.memoryCandidate.value,
        result.memoryCandidate.type,
        result.memoryCandidate.scope,
        "owner"
      );
      await appendLog("director_memory_stored", result.memoryCandidate);
    }

    // Send Director's response back to owner (if not an escalation resolution, or if it is, they still get the original response too if they want, but we already sent confirmation above, let's just send the clean reply)
    if (inbound.phone && !escalationResolved) {
      await sendSessionMessage(inbound.phone, result.reply);
    }

    return {
      status: 200,
      body: {
        status: "Director_replied",
        reply: result.reply,
        memoryStored: !!result.memoryCandidate,
      },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await appendLog("Director_processing_failed", { inbound, error: errMsg });

    // Return a graceful 200 instead of crashing with 500
    return {
      status: 200,
      body: { status: "error_handled", error: errMsg },
    };
  }
}

