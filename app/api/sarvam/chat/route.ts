import { NextResponse } from "next/server";
import { SALES_AGENT_PROMPT, DIRECTOR_SYSTEM_PROMPT } from "@/lib/server/prompts";
import { sarvamChat, sarvamChatStream, type ChatMessage } from "@/lib/server/sarvam";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const persona = body.persona === "Director" || body.persona === "director" ? "director" : "sales";
    const messages: ChatMessage[] = [
      { role: "system", content: persona === "director" ? DIRECTOR_SYSTEM_PROMPT : SALES_AGENT_PROMPT },
      ...(Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.text ?? "") }]),
    ];

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let content = "";
          try {
            for await (const chunk of sarvamChatStream(messages, {
              temperature: persona === "director" ? 0.15 : 0.25,
              maxTokens: 650,
            })) {
              content += chunk;
              controller.enqueue(encoder.encode(sse("delta", { content: chunk })));
            }

            await appendLog("sarvam_chat", { persona, text: body.text, reply: content, streamed: true });
            controller.enqueue(encoder.encode(sse("done", { ok: true, content })));
          } catch (error) {
            controller.enqueue(encoder.encode(sse("error", {
              ok: false,
              error: error instanceof Error ? error.message : "Sarvam chat failed",
            })));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const result = await sarvamChat(messages, {
      temperature: persona === "director" ? 0.15 : 0.25,
      maxTokens: 650,
    });
    await appendLog("sarvam_chat", { persona, text: body.text, reply: result.content, usage: result.usage });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sarvam chat failed" }, { status: 500 });
  }
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}


