import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export async function GET() {
  try {
    const db = getDatabase();
    const orders = db.prepare(`
      SELECT 
        e.id,
        e.size_inches,
        e.grammage,
        e.quality,
        e.color,
        e.lamination,
        e.quantity_kg,
        e.delivery_city,
        e.gst_details,
        e.delivery_terms,
        e.status,
        e.created_at,
        c.name as customer_name,
        c.phone as customer_phone
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      ORDER BY e.created_at DESC
    `).all();

    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

