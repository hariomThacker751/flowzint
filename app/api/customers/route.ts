import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const stage = url.searchParams.get("stage") || "";

    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM chat_messages cm 
         WHERE cm.customer_id = c.id AND cm.channel = 'customer_whatsapp'
         AND cm.role = 'user') as message_count,
        (SELECT cm.content FROM chat_messages cm 
         WHERE cm.customer_id = c.id AND cm.channel = 'customer_whatsapp'
         ORDER BY cm.created_at DESC LIMIT 1) as last_message,
        (SELECT cm.created_at FROM chat_messages cm 
         WHERE cm.customer_id = c.id AND cm.channel = 'customer_whatsapp'
         ORDER BY cm.created_at DESC LIMIT 1) as last_message_at
      FROM customers c
      WHERE c.stage != 'owner'
    `;
    const params: string[] = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (stage) {
      query += ` AND c.stage = ?`;
      params.push(stage);
    }

    query += ` ORDER BY c.updated_at DESC LIMIT 50`;

    const customers = db.prepare(query).all(...params);

    return NextResponse.json({ ok: true, customers });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get customers" },
      { status: 500 }
    );
  }
}

