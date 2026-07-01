import { NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/server/config";
import { getLogs, getAgentState, updateAgentState } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET() {
  const [state, logs] = await Promise.all([getAgentState(), getLogs()]);
  const ownerPhone = process.env.OWNER_PHONE || "";
  return NextResponse.json({
    state: { ...state, ownerPhone },
    config: getConfigStatus(),
    logs: logs.slice(0, 40),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tokenCancelDays =
    typeof body.tokenCancelDays === "number" && body.tokenCancelDays >= 1 && body.tokenCancelDays <= 30
      ? body.tokenCancelDays
      : undefined;
  const state = await updateAgentState({
    agentEnabled: typeof body.agentEnabled === "boolean" ? body.agentEnabled : undefined,
    raviEnabled: typeof body.raviEnabled === "boolean" ? body.raviEnabled : undefined,
    outboundSalesEnabled: typeof body.outboundSalesEnabled === "boolean" ? body.outboundSalesEnabled : undefined,
    autoSendRaviReplies: typeof body.autoSendRaviReplies === "boolean" ? body.autoSendRaviReplies : undefined,
    tokenCancelDays,
  });
  return NextResponse.json({ state, config: getConfigStatus() });
}

