import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const customerId = url.searchParams.get("customerId") || "";

    let query = `
      SELECT 
        q.*,
        c.name as customer_name,
        c.company as customer_company,
        c.phone as customer_phone,
        e.size_inches, e.grammage, e.quality, e.color, e.lamination, e.quantity_kg, e.delivery_city
      FROM quotes q
      JOIN customers c ON q.customer_id = c.id
      JOIN enquiries e ON q.enquiry_id = e.id
    `;
    const params: string[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`q.owner_approved = ?`);
      params.push(status === "approved" ? "1" : "0");
    }

    if (customerId) {
      conditions.push(`q.customer_id = ?`);
      params.push(customerId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY q.created_at DESC LIMIT 50`;

    const quotes = db.prepare(query).all(...params);

    return NextResponse.json({ ok: true, quotes });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get quotes" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, approved } = body;

    if (!quoteId || typeof approved !== "boolean") {
      return NextResponse.json({ ok: false, error: "Missing quoteId or approved" }, { status: 400 });
    }

    const db = getDatabase();
    // approved=true → 1 (approved), approved=false → -1 (rejected)
    const status = approved ? 1 : -1;
    db.prepare(`
      UPDATE quotes SET owner_approved = ?, approved_at = datetime('now') WHERE id = ?
    `).run(status, quoteId);

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, payload)
      VALUES (?, 'quote_approved', 'owner', ?)
    `).run(crypto.randomUUID(), JSON.stringify({ quoteId, approved }));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update quote" },
      { status: 500 }
    );
  }
}

