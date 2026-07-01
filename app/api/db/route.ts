import { NextResponse } from "next/server";
import { checkDatabaseHealth, seedTestData } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = checkDatabaseHealth();
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Health check failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    if (body.action === "seed") {
      const result = seedTestData();
      return NextResponse.json({ ok: result.success, ...result });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Database init failed" },
      { status: 500 }
    );
  }
}

