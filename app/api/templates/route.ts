import { NextResponse } from "next/server";
import { getOwnerTemplates, saveOwnerTemplate } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET() {
  const templates = await getOwnerTemplates();
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const language = String(body.language ?? "en").trim();
    const templateBody = String(body.body ?? "").trim();
    const category = String(body.category ?? "UTILITY").trim();

    if (!name || !templateBody) {
      return NextResponse.json({ ok: false, error: "Template name and body are required" }, { status: 400 });
    }

    const template = await saveOwnerTemplate({
      id: typeof body.id === "string" ? body.id : undefined,
      name,
      language,
      body: templateBody,
      category,
    });

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Template save failed" }, { status: 500 });
  }
}

