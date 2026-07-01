import { NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";

export const runtime = "nodejs";

/**
 * GET /api/chakra/messages?chatId=xxx  - get messages for a chat
 * GET /api/chakra/messages?phone=91xxx - get messages for a phone number
 * POST /api/chakra/messages            - send a message (owner reply)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId");
  const phone = url.searchParams.get("phone");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const page = parseInt(url.searchParams.get("page") || "1");

  const config = getConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.chakraApiKey}`,
    "Content-Type": "application/json",
  };

  try {
    let res: Response;

    if (chatId) {
      // List messages for a specific chat
      res = await fetch(`https://api.chakrahq.com/v1/ext/chat/${chatId}/message`, {
        method: "POST",
        headers,
        body: JSON.stringify({ limit, page }),
      });
    } else if (phone) {
      // List messages by phone number
      res = await fetch(
        `https://api.chakrahq.com/v1/ext/plugin/whatsapp/list-chat-messages-for-phone-number`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            customerPhoneNumber: phone.replace(/[^\d]/g, ""),
            limit,
            page,
          }),
        }
      );
    } else {
      return NextResponse.json(
        { ok: false, error: "Provide chatId or phone" },
        { status: 400 }
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: data?.message || data?._errors?.[0] || `ChakraHQ error ${res.status}`,
      });
    }

    const messages = data?._data ?? data?.data ?? data?.messages ?? data ?? [];
    return NextResponse.json({
      ok: true,
      messages: Array.isArray(messages) ? messages : [],
      meta: data?._meta ?? {},
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { to, text } = body;

  if (!to || !text) {
    return NextResponse.json({ ok: false, error: "Need 'to' phone and 'text'" }, { status: 400 });
  }

  const config = getConfig();
  const normalizedTo = String(to).replace(/[^\d]/g, "");
  const sendUrl = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${config.chakraPluginId}/api/${config.chakraApiVersion}/${config.chakraPhoneId}/messages`;

  const res = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.chakraApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    chakraResponse: data,
    sentTo: normalizedTo,
  });
}

