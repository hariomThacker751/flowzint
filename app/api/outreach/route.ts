import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { sendSessionMessage } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const message = "Hi! We are starting a new corrugator. Is there any requirement for box currently?";
    
    // Send message via ChakraHQ
    await sendSessionMessage(phone, message);

    // Update or insert customer and set stage to outreach_corrugator
    const db = getDatabase();
    
    const upsertCustomer = db.transaction((p: string) => {
      db.prepare(`
        INSERT OR IGNORE INTO customers (id, phone, name, language, stage)
        VALUES (?, ?, 'Unknown', 'en', 'outreach_corrugator')
      `).run(crypto.randomUUID(), p);
      
      db.prepare(`
        UPDATE customers SET stage = 'outreach_corrugator', updated_at = datetime('now')
        WHERE phone = ?
      `).run(p);
      
      return db.prepare("SELECT * FROM customers WHERE phone = ?").get(p);
    });

    const customer = upsertCustomer(phone) as any;

    // Log the outreach message as an assistant message in chat history
    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content)
      VALUES (?, ?, 'customer_whatsapp', 'assistant', ?)
    `).run(crypto.randomUUID(), customer.id, message);

    await appendLog("outreach_sent", { phone, stage: "outreach_corrugator" });

    return NextResponse.json({ success: true, message: "Outreach message sent and customer stage updated" });
  } catch (error) {
    console.error("Outreach API Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

