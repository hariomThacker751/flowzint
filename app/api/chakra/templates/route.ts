import { NextResponse } from "next/server";
import { createTemplate, listTemplates } from "@/lib/server/chakra";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listTemplates();
    await appendLog("chakra_templates_listed", { count: Array.isArray(result?.data) ? result.data.length : undefined });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Template list failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const language = String(body.language ?? "en").trim();
    const category = String(body.category ?? "UTILITY").trim();
    const templateBody = String(body.body ?? "").trim();
    if (!name || !templateBody) {
      return NextResponse.json({ ok: false, error: "Template name and body are required" }, { status: 400 });
    }
    const result = await createTemplate({ name, language, category, body: templateBody });
    await appendLog("chakra_template_created", { name, language, category, result });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Template create failed" }, { status: 500 });
  }
}

