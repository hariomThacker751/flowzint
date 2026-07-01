import { NextResponse } from "next/server";
import { sarvamChat } from "@/lib/server/sarvam";
import { getConfig } from "@/lib/server/config";

export const runtime = "nodejs";

/**
 * Test endpoint for Sarvam AI API
 * GET /api/test/sarvam - Test with a simple message
 */
export async function GET() {
  try {
    const config = getConfig();
    
    if (!config.sarvamApiKey) {
      return NextResponse.json({
        ok: false,
        error: "SARVAM_API_KEY is not configured"
      }, { status: 500 });
    }

    // Test with a simple message
    const result = await sarvamChat([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello in one sentence." }
    ], { temperature: 0.5, maxTokens: 50 });

    return NextResponse.json({
      ok: true,
      message: "Sarvam API is working",
      apiKey: `${config.sarvamApiKey.substring(0, 10)}...`,
      model: config.sarvamModel,
      testResponse: result.content,
      usage: result.usage
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Sarvam test failed",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

