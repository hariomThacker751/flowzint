import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({
    user: { username: session.username, role: session.role, name: session.name },
  });
}

