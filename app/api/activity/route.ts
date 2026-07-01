import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const type = url.searchParams.get("type") || "";

    let query = `
      SELECT 
        al.*,
        c.name as customer_name,
        c.company as customer_company,
        c.phone as customer_phone
      FROM activity_log al
      LEFT JOIN customers c ON al.customer_id = c.id
      WHERE al.event_type NOT LIKE '%ignored%'
    `;
    const params: (string | number)[] = [];

    if (type) {
      query += ` AND al.event_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ?`;
    params.push(limit);

    const events = db.prepare(query).all(...params);

    // Parse payload JSON
    const parsedEvents = events.map((e: any) => {
      try {
        return { ...e, payload: JSON.parse(e.payload || "{}") };
      } catch {
        return { ...e, payload: {} };
      }
    });

    return NextResponse.json({ ok: true, events: parsedEvents });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get activity" },
      { status: 500 }
    );
  }
}

