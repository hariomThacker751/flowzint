import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/ops/outbox — message delivery analytics + recent messages. */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const db = getDatabase();
  const byStatus = db.prepare(`SELECT status, COUNT(*) AS n FROM outbox GROUP BY status`).all();
  const byTemplate = db.prepare(`SELECT template_id, COUNT(*) AS n FROM outbox GROUP BY template_id ORDER BY n DESC LIMIT 12`).all();
  const byLanguage = db.prepare(`SELECT language, COUNT(*) AS n FROM outbox GROUP BY language ORDER BY n DESC`).all();
  const recent = db
    .prepare(
      `SELECT template_id, language, status, channel, recipient_phone, missing_vars, last_error, created_at, sent_at
       FROM outbox ORDER BY created_at DESC LIMIT 60`
    )
    .all() as any[];

  // Mask phone numbers for the dashboard.
  const masked = recent.map((r) => ({
    ...r,
    recipient_phone: r.recipient_phone ? r.recipient_phone.replace(/^(\d{2})\d+(\d{3})$/, "$1•••••$2") : r.recipient_phone,
  }));

  return NextResponse.json({ ok: true, byStatus, byTemplate, byLanguage, recent: masked });
}

