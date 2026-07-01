import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { getAgentState } from "@/lib/server/store";
import { getConfig, getConfigStatus } from "@/lib/server/config";

export const runtime = "nodejs";

/**
 * GET /api/system/status
 * Returns complete system health: agent state, ChakraHQ auth test, DB health, recent logs
 */
export async function GET() {
  const config = getConfig();
  const configStatus = getConfigStatus();
  const agentState = await getAgentState();
  const db = getDatabase();

  // DB health
  const tables: Record<string, number> = {};
  for (const table of ["customers", "chat_messages", "knowledge_base", "activity_log", "quotes"]) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
      tables[table] = row.c;
    } catch {
      tables[table] = -1;
    }
  }

  // Recent send failures
  const recentFailures = db
    .prepare(
      `SELECT event_type, payload, created_at FROM activity_log 
       WHERE event_type LIKE '%fail%' OR event_type LIKE '%error%'
       ORDER BY created_at DESC LIMIT 5`
    )
    .all()
    .map((r: any) => {
      try { return { ...r, payload: JSON.parse(r.payload) }; } catch { return r; }
    });

  // Test ChakraHQ send permission
  let chakraSendOk = false;
  let chakraSendError = "";
  let chakraSendStatus = 0;
  try {
    const res = await fetch(
      `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.chakraApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: "0000000000",
          type: "text",
          text: { body: "permission-test" },
        }),
      }
    );
    chakraSendStatus = res.status;
    const d = await res.json().catch(() => ({}));
    // 400 = auth OK but bad number, 401/403 = auth FAILED
    chakraSendOk = res.status !== 401 && res.status !== 403;
    chakraSendError = d?.message || d?.error?.message || "";
  } catch (e) {
    chakraSendError = String(e);
  }

  const issues: string[] = [];
  if (!configStatus.sarvamConfigured) issues.push("SARVAM_API_KEY not set");
  if (!configStatus.chakraConfigured) issues.push("ChakraHQ keys not fully configured");
  if (!chakraSendOk) issues.push(`ChakraHQ API key cannot send messages (HTTP ${chakraSendStatus}). Fix: regenerate key with WhatsApp Plugin WRITE permission`);
  if (!agentState.agentEnabled) issues.push("Agent is DISABLED - enable it in sidebar Runtime toggles");
  if (!agentState.raviEnabled) issues.push("Ravi is DISABLED - enable 'Ravi standby' in sidebar Runtime toggles");
  if (!agentState.autoSendRaviReplies) issues.push("Auto-reply is OFF - Ravi drafts but does not send. Enable 'Auto reply' in sidebar");

  return NextResponse.json({
    ok: issues.length === 0,
    timestamp: new Date().toISOString(),
    issues,
    agentState,
    configStatus,
    chakra: {
      sendPermission: chakraSendOk,
      sendStatus: chakraSendStatus,
      sendError: chakraSendError,
      sendUrl: `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}/messages`,
      fix: chakraSendOk
        ? "✅ ChakraHQ send permission OK"
        : "❌ Go to ChakraHQ Dashboard → Settings → API Keys → Create new API key → enable 'WhatsApp' scope with READ+WRITE → copy new key to CHAKRA_API_KEY in .env.local",
    },
    database: {
      healthy: Object.values(tables).every(c => c >= 0),
      tables,
    },
    recentFailures,
    webhookInstructions: {
      step1: "In ChakraHQ Dashboard → Settings → Webhooks",
      step2: "Set ONLY ONE URL: YOUR_CLOUDFLARE_URL/api/webhook/customer",
      step3: "Do NOT set /api/webhook/owner as a separate URL — this causes double-processing",
      step4: "The customer webhook now auto-routes your number (PRODUCTION_TEAM_PHONE) to Director",
    },
  });
}


