import { NextResponse } from "next/server";
import { checkDatabaseHealth, seedTestData } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = checkDatabaseHealth();
    
    return NextResponse.json({
      ok: health.healthy,
      ...health
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Database test failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = seedTestData();
    
    return NextResponse.json({
      ok: result.success,
      message: result.message,
      seeded: result.seeded
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Database seed failed" },
      { status: 500 }
    );
  }
}

