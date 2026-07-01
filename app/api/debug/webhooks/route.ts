import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();

    // Read message log
    let messageLog: any[] = [];
    try {
      const { getLogs } = await import("@/lib/server/store");
      messageLog = await getLogs();
    } catch {
      messageLog = [];
    }

    // Get customers with message counts
    const customers = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.customer_id = c.id) as total_messages,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.customer_id = c.id AND cm.role = 'user') as user_messages,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.customer_id = c.id AND cm.role = 'assistant') as ai_messages
      FROM customers c
      ORDER BY c.updated_at DESC
      LIMIT 20
    `).all();

    // Get recent messages from all customers
    const recentMessages = db.prepare(`
      SELECT 
        cm.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.company as customer_company
      FROM chat_messages cm
      LEFT JOIN customers c ON c.id = cm.customer_id
      ORDER BY cm.created_at DESC
      LIMIT 50
    `).all();

    // Read agent state
    const agentStatePath = path.join(process.cwd(), "data", "runtime", "agent-state.json");
    let agentState: any = {};
    try {
      const content = fs.readFileSync(agentStatePath, "utf-8");
      agentState = JSON.parse(content);
    } catch {
      agentState = { error: "Unable to read agent state" };
    }

    return NextResponse.json({
      ok: true,
      debug: {
        webhookLog: messageLog.slice(0, 20), // Last 20 webhook events
        customers: customers,
        recentMessages: recentMessages,
        agentState: agentState,
        timestamp: new Date().toISOString(),
        environment: {
          chakraConfigured: Boolean(process.env.CHAKRA_API_KEY && process.env.CHAKRA_PLUGIN_ID && process.env.CHAKRA_PHONE_ID),
          sarvamConfigured: Boolean(process.env.SARVAM_API_KEY),
          ownerPhone: process.env.OWNER_PHONE || process.env.PRODUCTION_TEAM_PHONE || "not set",
          webhookSecret: process.env.CHAKRA_WEBHOOK_SECRET ? "***set***" : "not set",
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to get debug info"
      },
      { status: 500 }
    );
  }
}

