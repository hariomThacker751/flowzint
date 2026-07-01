import { NextResponse } from "next/server";
import { getAllKnowledge, storeKnowledge, deleteKnowledge } from "@/lib/server/catalog";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") || "all") as "customer_visible" | "internal_only" | "all";
    const type = url.searchParams.get("type") || undefined;
    
    const knowledge = getAllKnowledge(scope, type);
    
    return NextResponse.json({ ok: true, knowledge });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get knowledge" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.key || !body.value || !body.type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: key, value, type" },
        { status: 400 }
      );
    }
    
    const validTypes = ["fact", "rule", "table", "template"];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { ok: false, error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }
    
    const validScopes = ["customer_visible", "internal_only"];
    if (body.scope && !validScopes.includes(body.scope)) {
      return NextResponse.json(
        { ok: false, error: `Invalid scope. Must be one of: ${validScopes.join(", ")}` },
        { status: 400 }
      );
    }
    
    const id = storeKnowledge({
      key: body.key,
      value: body.value,
      type: body.type,
      scope: body.scope || "internal_only",
      source: body.source || "owner",
    });
    
    // Log activity
    const db = getDatabase();
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, payload)
      VALUES (?, 'knowledge_updated', ?, ?)
    `).run(
      crypto.randomUUID(),
      body.source || "owner",
      JSON.stringify({ key: body.key, type: body.type, scope: body.scope })
    );
    
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to store knowledge" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id parameter" },
        { status: 400 }
      );
    }
    
    const deleted = deleteKnowledge(id);
    
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "Knowledge entry not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete knowledge" },
      { status: 500 }
    );
  }
}

