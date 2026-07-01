import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sarvamChat, sarvamChatStream, type ChatMessage } from "@/lib/server/sarvam";
import { DIRECTOR_SYSTEM_PROMPT } from "@/lib/server/prompts";
import { storeKnowledge } from "@/lib/server/catalog";
import { buildDatabaseContext } from "@/lib/server/director-agent";

export const runtime = "nodejs";

/**
 * director Chat API - Owner communicates with director
 * POST /api/director/chat
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, phone } = body;

    if (!message || !phone) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: message, phone" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get or create owner customer record
    let owner = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone) as any;
    if (!owner) {
      const ownerId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO customers (id, phone, name, language, stage)
        VALUES (?, ?, 'Owner', 'en', 'owner')
      `).run(ownerId, phone);
      owner = { id: ownerId, phone, name: "Owner", language: "en", stage: "owner" };
    }

    // Get conversation history before the new message so the LLM does not see it twice.
    const history = db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE customer_id = ? AND channel = 'owner_whatsapp'
      ORDER BY created_at DESC
      LIMIT 20
    `).all(owner.id) as Array<{ role: string; content: string }>;

    // Store owner message immediately so it is preserved even if the LLM call fails.
    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content)
      VALUES (?, ?, 'owner_whatsapp', 'user', ?)
    `).run(crypto.randomUUID(), owner.id, message);

    // Build live database context so director answers with real data
    const dbContext = buildDatabaseContext();

    // Build messages for director
    const messages: ChatMessage[] = [
      { role: "system", content: DIRECTOR_SYSTEM_PROMPT + "\n\n" + dbContext },
      ...history.reverse().map(h => ({
        role: h.role as "user" | "assistant",
        content: h.role === "assistant" ? stripReasoningLeak(h.content) : h.content,
      })),
      { role: "user", content: message },
    ];

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let directorContent = "";
          try {
            for await (const chunk of sarvamChatStream(messages, { temperature: 0.3, maxTokens: 1200 })) {
              directorContent += chunk;
              controller.enqueue(encoder.encode(sse("delta", { content: chunk })));
            }

            const visibledirectorContent = stripReasoningLeak(directorContent);
            const memoryExtracted = extractAndStoreMemory(visibledirectorContent, owner.id);
            const escalationResolved = await checkAndResolveEscalations(message, visibledirectorContent, owner.id);

            db.prepare(`
              INSERT INTO chat_messages (id, customer_id, channel, role, content)
              VALUES (?, ?, 'owner_whatsapp', 'assistant', ?)
            `).run(crypto.randomUUID(), owner.id, visibledirectorContent);

            db.prepare(`
              INSERT INTO activity_log (id, event_type, actor, customer_id, payload)
              VALUES (?, 'director_chat', 'director_agent', ?, ?)
            `).run(
              crypto.randomUUID(),
              owner.id,
              JSON.stringify({
                ownerMessage: message,
                directorResponse: visibledirectorContent,
                memoryExtracted,
                escalationResolved,
                streamed: true
              })
            );

            controller.enqueue(encoder.encode(sse("done", {
              ok: true,
              reply: visibledirectorContent,
              memoryExtracted,
              escalationResolved
            })));
          } catch (error) {
            controller.enqueue(encoder.encode(sse("error", {
              ok: false,
              error: error instanceof Error ? error.message : "director chat failed"
            })));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Get director's response
    const directorResponse = await sarvamChat(messages, { temperature: 0.3, maxTokens: 1200, enableReasoning: true });
    const visibledirectorContent = stripReasoningLeak(directorResponse.content);

    // Extract memory if present
    const memoryExtracted = extractAndStoreMemory(visibledirectorContent, owner.id);

    // Check if this resolves any pending escalations
    const escalationResolved = await checkAndResolveEscalations(message, visibledirectorContent, owner.id);

    // Store director's response
    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content)
      VALUES (?, ?, 'owner_whatsapp', 'assistant', ?)
    `).run(crypto.randomUUID(), owner.id, visibledirectorContent);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, customer_id, payload)
      VALUES (?, 'director_chat', 'director_agent', ?, ?)
    `).run(
      crypto.randomUUID(),
      owner.id,
      JSON.stringify({
        ownerMessage: message,
        directorResponse: visibledirectorContent,
        memoryExtracted,
        escalationResolved
      })
    );

    return NextResponse.json({
      ok: true,
      reply: visibledirectorContent,
      memoryExtracted,
      escalationResolved
    });
  } catch (error) {
    console.error("director chat error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "director chat failed",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Extract and store memory from director's response
 */
function extractAndStoreMemory(response: string, ownerId: string): boolean {
  const memoryPattern = /MEMORY_KEY:\s*(.+?)\nMEMORY_VALUE:\s*(.+?)\nMEMORY_TYPE:\s*(.+?)\nSCOPE:\s*(.+?)(?:\n|$)/s;
  const match = response.match(memoryPattern);

  if (match) {
    const [, key, value, type, scope] = match;
    
    try {
      storeKnowledge({
        key: key.trim(),
        value: value.trim(),
        type: type.trim() as any,
        scope: scope.trim() as any,
        source: 'owner'
      });

      // Also extract owner style if present
      const stylePattern = /OWNER_STYLE_NOTE:\s*(.+?)(?:\n|$)/;
      const styleMatch = response.match(stylePattern);
      if (styleMatch) {
        const db = getDatabase();
        db.prepare(`
          INSERT INTO activity_log (id, event_type, actor, payload)
          VALUES (?, 'owner_style_learned', 'director_agent', ?)
        `).run(
          crypto.randomUUID(),
          JSON.stringify({
            style: styleMatch[1].trim(),
            context: key.trim()
          })
        );
      }

      return true;
    } catch (error) {
      console.error("Error storing memory:", error);
      return false;
    }
  }

  return false;
}

/**
 * Check if owner's message resolves any pending escalations
 */
async function checkAndResolveEscalations(
  ownerMessage: string,
  directorResponse: string,
  ownerId: string
): Promise<boolean> {
  const match = directorResponse.match(/RESOLVE_ESCALATION:\s*([a-zA-Z0-9-]+)/);
  if (!match) return false;

  const escalationId = match[1];
  const db = getDatabase();

  const escalation = db.prepare("SELECT * FROM pending_escalations WHERE id = ?").get(escalationId) as any;
  if (!escalation || escalation.status !== 'pending') return false;

  // Extract the actual reply text (everything after RESOLVE_ESCALATION: ID)
  // or just use the whole response if it's mixed
  let customerReply = directorResponse.replace(/RESOLVE_ESCALATION:\s*[a-zA-Z0-9-]+/, "").trim();
  if (customerReply.length < 5) customerReply = ownerMessage; // Fallback to raw owner message

  // Mark escalation as resolved
  db.prepare(`
    UPDATE pending_escalations
    SET status = 'resolved', owner_reply = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(ownerMessage, escalationId);

  // Store knowledge if the owner is giving factual info
  try {
    const { storeKnowledge } = await import("@/lib/server/knowledge-base");
    storeKnowledge({
      key: `owner_answer:${Date.now()}`,
      value: `Customer asked: "${escalation.question}" → Owner answered: "${ownerMessage}"`,
      type: "fact",
      scope: "customer_visible",
      source: "owner",
    });
  } catch (_) { /* non-critical */ }

  // We should also push this reply to the customer's WhatsApp if we are auto-replying
  try {
    const { getAgentState, appendLog } = await import("@/lib/server/store");
    const { sendSessionMessage } = await import("@/lib/server/chakra");
    const state = await getAgentState();

    if (state.autoSendRaviReplies) {
      await sendSessionMessage(escalation.customer_phone, customerReply);

      // Store as chat message
      db.prepare(`
        INSERT INTO chat_messages (id, customer_id, channel, role, content)
        VALUES (?, ?, 'customer_whatsapp', 'assistant', ?)
      `).run(crypto.randomUUID(), escalation.customer_id, customerReply);

      await appendLog("ravi_forwarded_owner_reply", {
        escalationId,
        customerPhone: escalation.customer_phone,
        reply: customerReply,
      });
    }
  } catch (err) {
    console.error("Failed to forward resolved escalation to customer:", err);
  }

  return true;
}

/**
 * GET endpoint to retrieve conversation history
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Missing phone parameter" },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Get owner customer record
    const owner = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone) as any;
    if (!owner) {
      return NextResponse.json({
        ok: true,
        messages: [],
        pendingEscalations: []
      });
    }

    // Get conversation history
    const messages = db.prepare(`
      SELECT role, content, created_at FROM chat_messages
      WHERE customer_id = ? AND channel = 'owner_whatsapp'
      ORDER BY created_at ASC
    `).all(owner.id) as Array<{ role: string; content: string; created_at: string }>;

    // Get pending escalations
    const pendingEscalations = db.prepare(`
      SELECT * FROM activity_log
      WHERE event_type = 'director_needs_owner'
      AND actor = 'director_agent'
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    return NextResponse.json({
      ok: true,
      messages: messages.map((message) => ({
        ...message,
        content: message.role === "assistant" ? stripReasoningLeak(message.content) : message.content,
      })),
      pendingEscalations: pendingEscalations.map((e: any) => ({
        id: e.id,
        question: JSON.parse(e.payload).questionForOwner,
        customerContext: JSON.parse(e.payload).customerContext,
        customerPhone: JSON.parse(e.payload).customerPhone,
        customerName: JSON.parse(e.payload).customerName,
        createdAt: e.created_at
      }))
    });
  } catch (error) {
    console.error("director history error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to get history"
      },
      { status: 500 }
    );
  }
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function stripReasoningLeak(content: string) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("The user ")) return content;

  const splitAt = trimmed.indexOf("\n\n");
  if (splitAt === -1) return content;

  return trimmed.slice(splitAt + 2).trimStart();
}


