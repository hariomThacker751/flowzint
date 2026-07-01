import { NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";

export const runtime = "nodejs";

/**
 * GET /api/chakra/chats - List all ChakraHQ conversations
 * Uses correct ChakraHQ API: POST https://api.chakrahq.com/v1/ext/chat
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "25");
  const search = url.searchParams.get("search") || "";

  const config = getConfig();

  const missingKeys: string[] = [];
  if (!config.chakraApiKey) missingKeys.push("CHAKRA_API_KEY");
  if (!config.chakraPluginId) missingKeys.push("CHAKRA_PLUGIN_ID");
  if (!config.chakraPhoneId) missingKeys.push("CHAKRA_PHONE_ID");

  if (!config.chakraApiKey) {
    return NextResponse.json({
      ok: false,
      setupRequired: true,
      error: `Missing ChakraHQ credentials in .env.local: ${missingKeys.join(", ")}`,
      missingKeys,
      help: "Open .env.local in the project folder and replace the placeholder values with your real ChakraHQ API keys from https://app.chakrahq.com → Settings → API Keys",
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.chakraApiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const body: Record<string, unknown> = {
      orderField: "createdAt",
      orderDirection: "desc",
      limit,
      page,
    };
    if (search) {
      body.search = search;
    }

    const res = await fetch("https://api.chakrahq.com/v1/ext/chat", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.message || data?._errors?.[0] || `ChakraHQ returned ${res.status}`;
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: res.status === 401
          ? "ChakraHQ API key is invalid or expired. Go to https://app.chakrahq.com → Settings → API Keys and generate a new key, then update CHAKRA_API_KEY in .env.local"
          : errMsg,
        raw: data,
      });
    }

    // Normalize ChakraHQ response format: { _data: [], _meta: {} }
    const chats = data?._data ?? data?.data ?? data?.chats ?? data ?? [];
    const meta = data?._meta ?? {};

    return NextResponse.json({
      ok: true,
      chats: Array.isArray(chats) ? chats : [],
      meta,
      total: meta?.total ?? (Array.isArray(chats) ? chats.length : 0),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

