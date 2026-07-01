import { NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";
import { checkDatabaseHealth } from "@/lib/server/database";
import { getAgentState } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * System status endpoint - checks all components
 * GET /api/test/status
 */
export async function GET() {
  try {
    const config = getConfig();
    const dbHealth = checkDatabaseHealth();
    const agentState = await getAgentState();

    // Check configuration
    const configStatus = {
      chakraApiKey: !!config.chakraApiKey,
      chakraPluginId: !!config.chakraPluginId,
      chakraWabaId: !!config.chakraWabaId,
      chakraPhoneId: !!config.chakraPhoneId,
      sarvamApiKey: !!config.sarvamApiKey,
      sarvamModel: config.sarvamModel,
      productionTeamPhone: config.productionTeamPhone,
      databaseUrl: !!config.databaseUrl,
      webhookSecret: !!config.webhookSecret || "not set (optional)"
    };

    const allConfigured = 
      configStatus.chakraApiKey &&
      configStatus.chakraPluginId &&
      configStatus.chakraWabaId &&
      configStatus.chakraPhoneId &&
      configStatus.sarvamApiKey &&
      configStatus.databaseUrl;

    // Overall system status
    const systemReady = dbHealth.healthy && allConfigured;

    return NextResponse.json({
      ok: systemReady,
      timestamp: new Date().toISOString(),
      components: {
        agentState,
        database: {
          healthy: dbHealth.healthy,
          tables: dbHealth.tables,
          rowCounts: dbHealth.counts,
          issues: dbHealth.issues
        },
        configuration: {
          allConfigured,
          details: configStatus
        }
      },
      readiness: {
        systemReady,
        raviAgent: dbHealth.healthy && allConfigured,
        DirectorAgent: dbHealth.healthy && allConfigured,
        webhooks: dbHealth.healthy && allConfigured,
        autoReplyEnabled: agentState.agentEnabled && agentState.raviEnabled && agentState.autoSendRaviReplies,
        chakraIntegration: configStatus.chakraApiKey && configStatus.chakraPluginId && configStatus.chakraPhoneId,
        sarvamIntegration: configStatus.sarvamApiKey
      },
      nextSteps: systemReady ? [
        "System is ready!",
        "Test customer webhook: POST /api/test/webhook with type='customer'",
        "Test owner webhook: POST /api/test/webhook with type='owner'",
        "Configure ChakraHQ webhooks to point to your server",
        "Test with real WhatsApp messages"
      ] : [
        !dbHealth.healthy && "Fix database issues",
        !allConfigured && "Configure missing environment variables",
        "Run POST /api/test/db to seed test data if needed"
      ].filter(Boolean)
    });
  } catch (error) {
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Status check failed",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}


