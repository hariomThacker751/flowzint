import { NextResponse } from "next/server";
import { DirectorAgent } from "@/lib/server/director-agent";

export const runtime = "nodejs";

/**
 * GET /api/director/test?phone=919408724777
 * Get conversation history for owner
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const director = new DirectorAgent();
    const history = await director.getConversationHistory(phone, 20);

    return NextResponse.json({
      ok: true,
      phone,
      messageCount: history.length,
      history
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get conversation history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/director/test
 * Send a test message to director and get response
 * 
 * Body: { phone: string, message: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { ok: false, error: "Phone and message are required" },
        { status: 400 }
      );
    }

    const director = new DirectorAgent();

    // Get conversation history
    const history = await director.getConversationHistory(phone, 10);

    // Process owner message
    const result = await director.processOwnerMessage(phone, message, history);

    // If there's a memory candidate, store it automatically
    let memoryStored = false;
    if (result.memoryCandidate) {
      await director.storeMemory(
        result.memoryCandidate.key,
        result.memoryCandidate.value,
        result.memoryCandidate.type,
        result.memoryCandidate.scope,
        'owner'
      );
      memoryStored = true;
    }

    return NextResponse.json({
      ok: true,
      phone,
      message,
      reply: result.reply,
      memoryCandidate: result.memoryCandidate,
      memoryStored,
      conversationLength: history.length + 2 // +2 for the new messages
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "director test failed" },
      { status: 500 }
    );
  }
}


