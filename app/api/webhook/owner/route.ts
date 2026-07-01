import { NextResponse } from "next/server";
import { handleOwnerInbound } from "@/lib/server/webhook";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ status: "ok", endpoint: "owner" });
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read body" }, { status: 400 });
  }

  const signature = request.headers.get("x-chakra-signature-256");

  // ⚡ Acknowledge immediately — same fire-and-forget pattern as customer webhook
  setImmediate(async () => {
    try {
      await handleOwnerInbound(rawBody, signature);
    } catch (error) {
      await appendLog("owner_webhook_background_error", {
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
    }
  });

  return NextResponse.json({ status: "received" }, { status: 200 });
}

