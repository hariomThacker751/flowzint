import { NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * POST /api/chakra/send
 * Send a WhatsApp message via ChakraHQ.
 * Body: { to: "91XXXXXXXXXX", text: "Hello", mode?: "customer" | "sales" }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { to, text } = body;

  if (!to || !text) {
    return NextResponse.json(
      { ok: false, error: "Missing 'to' and/or 'text'" },
      { status: 400 }
    );
  }

  const config = getConfig();
  if (!config.chakraApiKey || !config.chakraPluginId || !config.chakraPhoneId) {
    return NextResponse.json(
      {
        ok: false,
        error: "ChakraHQ not configured. Set CHAKRA_API_KEY, CHAKRA_PLUGIN_ID, CHAKRA_PHONE_ID in .env.local",
      },
      { status: 500 }
    );
  }

  const normalizedTo = String(to).replace(/[^\d]/g, "");
  const sendUrl = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "text",
    text: { body: text },
  };

  try {
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.chakraApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    await appendLog("chakra_send_attempt", {
      to: normalizedTo,
      status: res.status,
      ok: res.ok,
      response: data,
    });

    if (!res.ok) {
      const errCode = data?.code || "";
      const errMsg = data?.message || `HTTP ${res.status}`;

      // Provide specific guidance
      let guidance = "";
      if (res.status === 401 || errCode === "UNAUTHORIZED") {
        guidance =
          "API key missing 'send message' permission. " +
          "Fix: ChakraHQ Dashboard → Settings → API Keys → " +
          "Create new key with 'Plugin: WhatsApp Write' permission enabled.";
      } else if (res.status === 400) {
        guidance =
          "Session may be expired (customer must message first within 24h). " +
          "Or phone number format is wrong.";
      }

      return NextResponse.json({
        ok: false,
        status: res.status,
        error: errMsg,
        guidance,
        sendUrl,
        payload,
        chakraResponse: data,
      });
    }

    return NextResponse.json({
      ok: true,
      status: res.status,
      chakraResponse: data,
      to: normalizedTo,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await appendLog("chakra_send_error", { to: normalizedTo, error: errMsg });
    return NextResponse.json(
      { ok: false, error: errMsg },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chakra/send - check ChakraHQ config status
 */
export async function GET() {
  const config = getConfig();
  const sendUrl = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}/messages`;

  // Quick auth test
  let authTest: { ok: boolean; status?: number; error?: string } = { ok: false };
  try {
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.chakraApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: "0000000000",
        type: "text",
        text: { body: "test" },
      }),
    });
    const d = await res.json().catch(() => ({}));
    // 400 = Auth OK but bad number, 401 = Auth FAILED
    authTest = {
      ok: res.status !== 401 && res.status !== 403,
      status: res.status,
      error: d?.message,
    };
  } catch (e) {
    authTest = { ok: false, error: String(e) };
  }

  return NextResponse.json({
    configured: Boolean(
      config.chakraApiKey && config.chakraPluginId && config.chakraPhoneId
    ),
    sendPermission: authTest.ok,
    sendUrl,
    authTestStatus: authTest.status,
    authTestError: authTest.error,
    fix: authTest.ok
      ? "ChakraHQ send permission is OK"
      : "Go to ChakraHQ Dashboard → Settings → API Keys → Regenerate key with WhatsApp Plugin WRITE permission",
  });
}

