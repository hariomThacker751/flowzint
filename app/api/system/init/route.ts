import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/system/init
 * Initialize system
 */
export async function POST() {
  try {
    return NextResponse.json({
      ok: true,
      message: "System initialized successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to initialize",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system/init
 * Check initialization status
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "System initialization endpoint",
  });
}

