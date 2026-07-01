import { getConfig } from "@/lib/server/config";
import { appendLog } from "./store";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type SarvamChatOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  enableReasoning?: boolean; // Opt-IN for reasoning (default: false)
};

type SarvamResponse = {
  content: string;
  usage?: any;
  model?: string;
  finishReason?: string;
  hadRetry?: boolean;
  reasoningDisabled?: boolean;
  json?: any;
};

/**
 * Call Sarvam Chat API with robust retry and fallback logic.
 *
 * DEFAULT: Reasoning DISABLED. Most tasks (NLG, NLU, Director Q&A) don't need reasoning.
 * The ~105B model handles them fine without it, and disabling reasoning guarantees
 * all tokens go to the visible response.
 *
 * Opt-IN reasoning: set enableReasoning: true for complex multi-step tasks.
 * When reasoning is enabled, we give 4096 tokens so reasoning has room.
 */
export async function sarvamChat(
  messages: ChatMessage[],
  options?: SarvamChatOptions
): Promise<SarvamResponse> {
  const config = getConfig();
  if (!config.sarvamApiKey) {
    throw new Error("SARVAM_API_KEY is not configured");
  }

  const mergedMessages = mergeConsecutiveRoles(messages);

  // Inject JSON instruction if needed
  if (options?.jsonMode) {
    if (mergedMessages[0].role === "system") {
      mergedMessages[0].content += `\n\nCRITICAL: Output ONLY valid JSON. No markdown \`\`\`json blocks. No conversational text.`;
    } else {
      mergedMessages.unshift({ role: "system", content: "CRITICAL: Output ONLY valid JSON. No markdown \`\`\`json blocks. No conversational text." });
    }
  }

  const maxTokens = options?.maxTokens ?? 2048;
  const temperature = options?.temperature ?? 0.25;
  const useReasoning = options?.enableReasoning === true; // Opt-IN only

  const tryParseJSON = (str: string) => {
    try {
      let clean = str.trim();
      if (clean.startsWith("```json")) clean = clean.substring(7);
      if (clean.startsWith("```")) clean = clean.substring(3);
      if (clean.endsWith("```")) clean = clean.substring(0, clean.length - 3);
      return JSON.parse(clean.trim());
    } catch {
      return null;
    }
  };

  // ── Try up to 3 times with progressively safer settings ──
  let lastError: Error | null = null;
  const retryConfigs: Array<{
    maxTokens: number;
    temperature: number;
    timeout: number;
    reasoningEffort: "low" | "medium" | "high" | null;
    label: string;
  }> = [];

  if (useReasoning) {
    // Reasoning path: try with reasoning first, then without
    retryConfigs.push(
      { maxTokens: 4096, temperature, timeout: 45000, reasoningEffort: "low", label: "reasoning_low" },
      { maxTokens: 2048, temperature, timeout: 30000, reasoningEffort: null, label: "no_reasoning_fallback" },
    );
  } else if (options?.jsonMode) {
    // JSON mode: no reasoning ever (it breaks JSON), just retry with different temps
    retryConfigs.push(
      { maxTokens, temperature: 0.1, timeout: 30000, reasoningEffort: null, label: "json_strict" },
      { maxTokens: Math.max(maxTokens, 1024), temperature: 0.2, timeout: 30000, reasoningEffort: null, label: "json_retry" },
    );
  } else {
    // Normal mode: no reasoning, single attempt with generous timeout
    retryConfigs.push(
      { maxTokens, temperature, timeout: 45000, reasoningEffort: null, label: "standard" },
      { maxTokens: Math.max(maxTokens, 1024), temperature: 0.3, timeout: 30000, reasoningEffort: null, label: "standard_retry" },
    );
  }

  for (let i = 0; i < retryConfigs.length; i++) {
    const cfg = retryConfigs[i];
    try {
      const result = await callSarvamAPI(mergedMessages, {
        maxTokens: cfg.maxTokens,
        temperature: cfg.temperature,
        timeout: cfg.timeout,
        reasoningEffort: cfg.reasoningEffort,
      });

      // Success with content
      if (result.content) {
        if (options?.jsonMode) {
          const parsed = tryParseJSON(result.content);
          if (parsed) {
            return {
              ...result,
              hadRetry: i > 0,
              reasoningDisabled: cfg.reasoningEffort === null,
              json: parsed,
            };
          }
          // JSON parsing failed → retry
          console.warn(`[Sarvam] JSON parse failed on attempt ${i + 1}, retrying...`);
          lastError = new Error(`JSON parse failed. Raw: ${result.content.substring(0, 200)}`);
          continue;
        }
        return {
          ...result,
          hadRetry: i > 0,
          reasoningDisabled: cfg.reasoningEffort === null,
        };
      }

      // Empty content but has reasoning_content → try to extract conclusion
      if (result.reasoningContent) {
        const extracted = extractConclusion(result.reasoningContent);
        if (extracted && extracted.length > 5) {
          console.warn(`[Sarvam] Extracted conclusion from reasoning on attempt ${i + 1}`);
          return {
            content: extracted,
            usage: result.usage,
            model: result.model,
            hadRetry: true,
            reasoningDisabled: false,
          };
        }
      }

      // Empty response → retry with next config
      console.warn(`[Sarvam] Empty response on attempt ${i + 1} (${cfg.label}), retrying...`);
      lastError = new Error(`Sarvam returned empty response (${cfg.label})`);

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Sarvam] Attempt ${i + 1} (${cfg.label}) failed: ${lastError.message}`);

      // If it's an abort/timeout, try with longer timeout next
      if (lastError.message.includes("abort") || lastError.message.includes("timeout")) {
        continue;
      }

      // For other errors, also retry (might be transient)
      continue;
    }
  }

  // All retries exhausted
  throw new Error(
    `Sarvam failed after ${retryConfigs.length} attempts. ` +
    `Model: ${config.sarvamModel}. Messages: ${mergedMessages.length}. ` +
    `Last error: ${lastError?.message || "unknown"}`
  );
}

/**
 * Low-level Sarvam API call with configurable reasoning.
 */
async function callSarvamAPI(
  messages: ChatMessage[],
  opts: {
    maxTokens: number;
    temperature: number;
    timeout: number;
    reasoningEffort: "low" | "medium" | "high" | null;
  }
): Promise<{
  content: string;
  reasoningContent?: string;
  finishReason?: string;
  usage?: any;
  model?: string;
}> {
  const config = getConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const body: Record<string, any> = {
      model: config.sarvamModel,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      reasoning_effort: opts.reasoningEffort, // null → JSON null → reasoning DISABLED
      frequency_penalty: 0.7, // Strong penalty to prevent token/phrase repetition ("Kem chhe? Kem chhe?")
      presence_penalty: 0.35, // Moderate variety encouragement — prevents stale loops without garbling scripts
    };

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": config.sarvamApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg =
        data?.error?.message ??
        data?.message ??
        `Sarvam ${response.status}`;
      throw new Error(msg);
    }

    const choice = data?.choices?.[0];
    const message = choice?.message ?? {};
    const content = typeof message.content === "string" ? message.content.trim() : "";
    const reasoningContent =
      typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
    const finishReason = choice?.finish_reason ?? "";

    if (finishReason === "length" && !content && !reasoningContent) {
      console.warn(
        `[Sarvam] finish_reason=length with no content. max_tokens=${opts.maxTokens} may be too low.`
      );
    }

    return {
      content,
      reasoningContent: reasoningContent || undefined,
      finishReason,
      usage: data?.usage,
      model: data?.model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract the final conclusion/answer from reasoning content.
 * Improved: tries multiple strategies to find the actual response.
 */
function extractConclusion(reasoning: string): string {
  if (!reasoning) return "";

  // Strategy 1: Look for explicit response markers
  const responseMarkers = [
    // English
    /(?:final response|the response (?:should|would|will) be|my response|customer message|reply to customer|send to customer|customer ko bhejo|whatsapp message)[:\s]*["']?(.{10,500}?)["']?\s*$/im,
    /(?:therefore|thus|so|hence|finally|in conclusion|answer|response)[:\s]*["']?(.{10,500}?)["']?\s*$/im,
    // Hindi / Hinglish
    /(?:इसलिए|अतः|तो|अंत में|उत्तर|जवाब|reply|जवाब दो)[:\s]*["']?(.{10,500}?)["']?\s*$/im,
    // Gujarati
    /(?:તેથી|તો|છેલ્લે|જવાબ|reply)[:\s]*["']?(.{10,500}?)["']?\s*$/im,
  ];

  for (const marker of responseMarkers) {
    const match = reasoning.match(marker);
    if (match) {
      const extracted = (match[1] || match[0]).trim();
      if (extracted.length > 5 && extracted.length < 2000) {
        // Clean up common artifacts
        return extracted
          .replace(/^["']|["']$/g, "")
          .replace(/^(I should say|I would say|I will say|I'll say|say:|respond with:)\s*/i, "")
          .trim();
      }
    }
  }

  // Strategy 2: Find the last substantial paragraph that looks like a response
  const paragraphs = reasoning.split(/\n\n+/).filter(p => p.trim().length > 10);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i].trim();
    // Skip meta-commentary paragraphs
    if (
      p.startsWith("Let me") ||
      p.startsWith("I need") ||
      p.startsWith("The user") ||
      p.startsWith("First") ||
      p.startsWith("Note:") ||
      p.startsWith("Based on") ||
      p.startsWith("Given that") ||
      p.startsWith("Checking") ||
      p.length < 10
    ) {
      continue;
    }
    // If it looks like a customer-facing message (no meta-language), use it
    if (!/\b(I think|I would|I should|I will|let's|the answer|my analysis|reasoning)\b/i.test(p)) {
      if (p.length > 5 && p.length < 2000) return p;
    }
  }

  // Strategy 3: Last substantial sentence
  const sentences = reasoning.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i].trim();
    if (
      s.length > 10 &&
      s.length < 500 &&
      !/\b(I think|I would|my analysis|reasoning|let me|therefore)\b/i.test(s)
    ) {
      return s;
    }
  }

  return "";
}

/**
 * Sarvam API strictly requires alternating roles.
 * Merge consecutive messages of the same role.
 */
function mergeConsecutiveRoles(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const msg of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += "\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }
  return merged;
}

export async function* sarvamChatStream(
  messages: ChatMessage[],
  options?: SarvamChatOptions
): AsyncGenerator<string> {
  const config = getConfig();
  if (!config.sarvamApiKey) {
    throw new Error("SARVAM_API_KEY is not configured");
  }

  const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "api-subscription-key": config.sarvamApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.sarvamModel,
      messages,
      temperature: options?.temperature ?? 0.25,
      max_tokens: options?.maxTokens ?? 1024,
      stream: true,
      reasoning_effort: null,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data?.error?.message ?? data?.message ?? `Sarvam request failed with ${response.status}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Sarvam streaming response did not include a body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      const data = JSON.parse(payload);
      const content =
        data?.choices?.[0]?.delta?.content ??
        data?.choices?.[0]?.message?.content ??
        "";

      if (content) {
        yield String(content);
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    const payload = trailing.slice(5).trim();
    if (payload && payload !== "[DONE]") {
      const data = JSON.parse(payload);
      const content =
        data?.choices?.[0]?.delta?.content ??
        data?.choices?.[0]?.message?.content ??
        "";

      if (content) {
        yield String(content);
      }
    }
  }
}

