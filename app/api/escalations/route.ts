import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

// GET /api/escalations — list pending escalations (what needs owner's attention)
export async function GET() {
  try {
    const db = getDatabase();

    const escalations = db.prepare(`
      SELECT pe.*, c.name as customer_name, c.phone as customer_phone, c.stage,
             c.language
      FROM pending_escalations pe
      LEFT JOIN customers c ON pe.customer_id = c.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC
      LIMIT 50
    `).all() as any[];

    return NextResponse.json({
      ok: true,
      escalations: escalations.map((e: any) => ({
        id: e.id,
        customerPhone: e.customer_phone,
        customerName: e.customer_name || "Unknown",
        customerStage: e.stage,
        question: e.question,
        holdingMessage: e.holding_message,
        createdAt: e.created_at,
        language: e.language || "en",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/escalations — owner replies or resolves
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { escalationId, action, reply } = body;
    // action: "reply" | "dismiss" | "resolve"
    // reply: the owner's answer to send to customer (required for "reply")

    if (!escalationId) {
      return NextResponse.json({ error: "escalationId required" }, { status: 400 });
    }

    const db = getDatabase();

    const esc = db.prepare(`
      SELECT * FROM pending_escalations WHERE id = ?
    `).get(escalationId) as any;

    if (!esc) {
      return NextResponse.json({ error: "Escalation not found" }, { status: 404 });
    }

    if (action === "reply" && reply) {
      // Send owner's reply to customer via WhatsApp
      const customer = db.prepare(`
        SELECT phone, id FROM customers WHERE id = ?
      `).get(esc.customer_id) as any;

      if (customer?.phone) {
        await sendSessionMessage(customer.phone, reply);

        // Log the owner reply in chat history
        db.prepare(`
          INSERT INTO chat_messages (id, customer_id, channel, role, content)
          VALUES (?, ?, 'customer_whatsapp', 'assistant', ?)
        `).run(crypto.randomUUID(), esc.customer_id, reply);
      }

      // Learn the rule
      let learnedRule = reply;
      if (esc.question && esc.question.startsWith("Confused by: ")) {
        const customerText = esc.question.replace("Confused by: ", "").trim();
        if (customerText) {
          learnedRule = `If the customer says "${customerText}", you should say: "${reply}"`;
        }
      }
      
      // Save to knowledge base
      db.prepare(`
        INSERT INTO knowledge_base (id, key, value, type, scope, source)
        VALUES (?, ?, ?, 'conversation_rule', 'customer_visible', 'owner_escalation')
      `).run(crypto.randomUUID(), 'rule_' + Date.now(), learnedRule);

      // Mark escalation resolved
      db.prepare(`
        UPDATE pending_escalations
        SET status = 'resolved', owner_reply = ?, resolved_at = datetime('now')
        WHERE id = ?
      `).run(reply, escalationId);

      await appendLog("escalation_resolved", {
        escalationId,
        action: "reply",
        customerPhone: esc.customer_phone,
      });

      return NextResponse.json({ ok: true, resolved: true });
    }

    if (action === "dismiss") {
      db.prepare(`
        UPDATE pending_escalations
        SET status = 'dismissed', resolved_at = datetime('now')
        WHERE id = ?
      `).run(escalationId);

      await appendLog("escalation_dismissed", { escalationId });
      return NextResponse.json({ ok: true, dismissed: true });
    }

    if (action === "resolve") {
      db.prepare(`
        UPDATE pending_escalations
        SET status = 'resolved', resolved_at = datetime('now')
        WHERE id = ?
      `).run(escalationId);

      await appendLog("escalation_resolved", { escalationId, action: "resolve" });
      return NextResponse.json({ ok: true, resolved: true });
    }

    return NextResponse.json({ error: "Invalid action. Use 'reply', 'dismiss', or 'resolve'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

