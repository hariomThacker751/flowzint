import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "Missing customerId" }, { status: 400 });
    }

    const messages = db.prepare(`
      SELECT * FROM chat_messages
      WHERE customer_id = ? AND channel = 'customer_whatsapp'
      ORDER BY created_at ASC
    `).all(customerId);

    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);

    return NextResponse.json({ ok: true, messages, customer });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, message, role } = body;

    if (!customerId || !message) {
      return NextResponse.json({ ok: false, error: "Missing customerId or message" }, { status: 400 });
    }

    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content)
      VALUES (?, ?, 'customer_whatsapp', ?, ?)
    `).run(id, customerId, role || "user", message);

    // Update customer updated_at
    db.prepare("UPDATE customers SET updated_at = datetime('now') WHERE id = ?").run(customerId);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}

