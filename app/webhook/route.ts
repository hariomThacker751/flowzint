import { NextResponse } from "next/server";
import { handleCustomerInbound } from "@/lib/server/webhook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ status: "ok", endpoint: "fallback-webhook" });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const result = await handleCustomerInbound(rawBody, request.headers.get("x-chakra-signature-256"));
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Fallback webhook failed" }, { status: 500 });
  }
}

