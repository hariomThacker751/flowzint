import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/ops/approvals — stamped approval audit trail (Guidelines §8). */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const approvals = db
    .prepare(`SELECT entity_type, entity_id, action, approver, approver_role, stamp, notes, created_at FROM approvals ORDER BY created_at DESC LIMIT 100`)
    .all();
  return NextResponse.json({ ok: true, approvals });
}

