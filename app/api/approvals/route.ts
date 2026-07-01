import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * GET /api/approvals
 * Returns the unified approval audit trail (Section 8).
 * Optional ?refType=escalation to filter by type.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const refType = url.searchParams.get("refType");
  const db = getDatabase();

  let rows: any[] = [];
  try {
    if (refType) {
      rows = db.prepare(`
        SELECT id, ref_type, ref_id, customer_name, spec, approver, action, notes, created_at
        FROM approvals WHERE ref_type = ?
        ORDER BY created_at DESC LIMIT 100
      `).all(refType);
    } else {
      rows = db.prepare(`
        SELECT id, ref_type, ref_id, customer_name, spec, approver, action, notes, created_at
        FROM approvals
        ORDER BY created_at DESC LIMIT 100
      `).all();
    }
  } catch {
    // approvals table may not exist yet — return empty
    return NextResponse.json({ ok: true, approvals: [] });
  }

  return NextResponse.json({ ok: true, approvals: rows });
}

/**
 * POST /api/approvals
 * Stamp a unified approval: "[Action] by [Approver] at [HH:MM, Date]".
 * Used by every approval flow: escalations, tokens, trading desk, quality gate, deal desk.
 *
 * Body: {
 *   refType: "escalation" | "token" | "trading" | "quality_gate" | "deal_desk" | "base_price",
 *   refId?: string,
 *   customerName?: string,
 *   spec?: string,
 *   approver: "Puneet" | "Dev" | "Manager",   // mandatory
 *   action: "Approved" | "Declined" | "Approved with Modification",
 *   notes?: string,
 * }
 *
 * If refType is "escalation", it also resolves the pending escalation (so Ravi resumes).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const approver = typeof body.approver === "string" ? body.approver.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const refType = typeof body.refType === "string" ? body.refType.trim() : "";

  if (!approver || !action || !refType) {
    return NextResponse.json(
      { ok: false, error: "approver, action, and refType are required" },
      { status: 400 },
    );
  }

  const now = new Date();
  const stamp = `${action} by ${approver} at ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}, ${now.toLocaleDateString("en-IN")}`;
  const id = crypto.randomUUID();

  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO approvals (id, ref_type, ref_id, customer_name, spec, approver, action, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      refType,
      body.refId ? String(body.refId) : null,
      body.customerName ? String(body.customerName) : null,
      body.spec ? String(body.spec) : null,
      approver,
      action,
      body.notes ? String(body.notes) : null,
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "approvals table not initialized: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    );
  }

  // If this is an escalation approval, resolve it so Ravi can resume the customer
  if (refType === "escalation" && body.refId) {
    try {
      const escalation = db.prepare("SELECT * FROM pending_escalations WHERE id = ?").get(body.refId) as any;
      if (escalation && escalation.status === "pending") {
        db.prepare(`
          UPDATE pending_escalations
          SET status = 'resolved', owner_reply = ?, resolved_at = datetime('now')
          WHERE id = ?
        `).run(body.notes ? `${stamp} — ${body.notes}` : stamp, body.refId);
      }
    } catch {
      // best-effort — escalation resolution is optional
    }
  }

  await appendLog("approval_stamped", { id, refType, approver, action, stamp, refId: body.refId });

  return NextResponse.json({ ok: true, id, stamp });
}

