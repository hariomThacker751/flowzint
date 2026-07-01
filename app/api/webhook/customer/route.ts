import { NextResponse } from "next/server";
import { handleCustomerInbound } from "@/lib/server/webhook";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";
// Increase the max duration for background processing (Node.js only)
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ status: "ok", endpoint: "customer" });
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read body" }, { status: 400 });
  }

  const signature = request.headers.get("x-chakra-signature-256");

  // ⚡ Acknowledge immediately — ChakraHQ has tight delivery timeouts.
  // We fire-and-forget the actual processing so the LLM call never blocks
  // the HTTP response. If we didn't do this, a slow LLM (5-15s) would cause
  // ChakraHQ to retry the webhook, sending the customer duplicate messages.
  setImmediate(async () => {
    try {
      await handleCustomerInbound(rawBody, signature);
    } catch (error) {
      await appendLog("customer_webhook_background_error", {
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
    }
  });

  return NextResponse.json({ status: "received" }, { status: 200 });
}

