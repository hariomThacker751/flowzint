import { getConfig } from "@/lib/server/config";
import { appendLog } from "@/lib/server/store";

/**
 * WhatsApp text message character limit (4096 per Meta docs).
 * We stay well below the hard limit to avoid 400 errors from ChakraHQ
 * and to keep messages readable on mobile. 2000 chars is generous for a
 * WhatsApp conversation — users on phones shouldn't scroll through essays.
 */
const WHATSAPP_MAX_LENGTH = 2000;

function chakraHeaders() {
  const config = getConfig();
  if (!config.chakraApiKey) {
    throw new Error("CHAKRA_API_KEY is not configured");
  }
  return {
    Authorization: `Bearer ${config.chakraApiKey}`,
    "Content-Type": "application/json",
  };
}

function messageBaseUrl() {
  const config = getConfig();
  if (!config.chakraPluginId || !config.chakraPhoneId) {
    throw new Error("CHAKRA_PLUGIN_ID or CHAKRA_PHONE_ID is not configured");
  }
  return `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}`;
}

function templateBaseUrl() {
  const config = getConfig();
  if (!config.chakraWabaId) {
    throw new Error("CHAKRA_WABA_ID is not configured");
  }
  return `https://api.chakrahq.com/v1/ext/plugin/whatsapp/api/${config.chakraApiVersion}/${config.chakraWabaId}`;
}

/**
 * Truncate a message to fit WhatsApp limits while keeping it readable.
 * Strategy:
 * 1. If message is already short enough → return as-is.
 * 2. If long → try to cut at the last sentence boundary within the limit.
 * 3. If no sentence boundary found → cut at the last word boundary.
 * 4. Always append a brief continuation hint when truncated.
 */
export function truncateMessage(text: string, maxLength: number = WHATSAPP_MAX_LENGTH): { body: string; truncated: boolean } {
  if (!text || text.length <= maxLength) {
    return { body: text || "", truncated: false };
  }

  // Try sentence boundary (look for . ! ? followed by space or end, going backwards from maxLength)
  const searchStart = Math.floor(maxLength * 0.8); // start looking from 80% of the limit
  const segment = text.slice(0, maxLength);

  // Find the last sentence-ending punctuation within the limit
  const sentenceEndMatch = segment.slice(searchStart).match(/[.!?](?:\s|$)/);
  if (sentenceEndMatch && searchStart + (sentenceEndMatch.index || 0) + 1 < maxLength) {
    const cutIndex = searchStart + (sentenceEndMatch.index || 0) + 1;
    return { body: text.slice(0, cutIndex).trim(), truncated: true };
  }

  // Try word boundary as fallback
  const lastSpace = segment.lastIndexOf(" ");
  if (lastSpace > searchStart) {
    return { body: text.slice(0, lastSpace).trim(), truncated: true };
  }

  // Last resort: hard cut at the limit
  return { body: text.slice(0, maxLength).trim(), truncated: true };
}

export async function sendSessionMessage(to: string, text: string) {
  const maxRetries = 3;
  let lastError: Error | null = null;
  const normalizedTo = String(to).replace(/[^\d]/g, "");

  if (!normalizedTo) {
    throw new Error("Missing WhatsApp recipient phone number");
  }

  // ── Truncate long messages before sending ────────────────────────────────
  let { body: safeText, truncated } = truncateMessage(text);
  if (truncated) {
    await appendLog("whatsapp_message_truncated", {
      to: normalizedTo,
      originalLength: text.length,
      truncatedLength: safeText.length,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${messageBaseUrl()}/messages`, {
        method: "POST",
        headers: chakraHeaders(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedTo,
          type: "text",
          text: { body: safeText },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.error?.message ?? data?.message ?? `Chakra send failed with ${response.status}`;

        // Retry on transient errors (5xx, rate limits)
        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(message);
          if (attempt < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            continue;
          }
        }

        throw new Error(message);
      }

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a network error, retry
      if (error instanceof Error && error.message.includes('fetch')) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
          continue;
        }
      }

      // For other errors, throw immediately
      throw lastError;
    }
  }

  throw lastError || new Error("ChakraHQ send failed after multiple retries");
}

/**
 * Send a document (e.g. the Proforma Invoice PDF) via a public link.
 * Implements the same retry/backoff policy as text sends. `link` must be a
 * publicly fetchable URL (ChakraHQ/Meta downloads it server-side).
 */
export async function sendMediaMessage(to: string, link: string, caption: string, filename: string) {
  const normalizedTo = String(to).replace(/[^\d]/g, "");
  if (!normalizedTo) throw new Error("Missing WhatsApp recipient phone number");
  if (!link) throw new Error("Missing media link");

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${messageBaseUrl()}/messages`, {
        method: "POST",
        headers: chakraHeaders(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedTo,
          type: "document",
          document: { link, caption: truncateMessage(caption, 1000).body, filename },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message ?? data?.message ?? `Chakra media send failed with ${response.status}`;
        if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
          lastError = new Error(message);
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
          continue;
        }
        throw new Error(message);
      }
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.message.includes("fetch") && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error("ChakraHQ media send failed after retries");
}

export async function sendTemplateMessage(to: string, templateName: string, language: string, parapieces: string[]) {
  const response = await fetch(`${messageBaseUrl()}/messages`, {
    method: "POST",
    headers: chakraHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { policy: "deterministic", code: language },
        components: [
          {
            type: "body",
            parapieces: parapieces.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? data?.message ?? `Chakra template send failed with ${response.status}`);
  }
  return data;
}

export async function createTemplate(input: { name: string; category: string; language: string; body: string }) {
  const response = await fetch(`${templateBaseUrl()}/message_templates`, {
    method: "POST",
    headers: chakraHeaders(),
    body: JSON.stringify({
      category: input.category,
      language: input.language,
      name: input.name,
      components: [{ type: "BODY", text: input.body }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? data?.message ?? `Chakra create template failed with ${response.status}`);
  }
  return data;
}

export async function listTemplates() {
  const response = await fetch(`${templateBaseUrl()}/message_templates`, {
    method: "GET",
    headers: chakraHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message ?? data?.message ?? `Chakra list templates failed with ${response.status}`);
  }
  return data;
}
