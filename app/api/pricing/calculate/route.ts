import { NextResponse } from "next/server";
import { calculatePrice } from "@/lib/server/pricing-engine";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ["sizeInches", "grammage", "quality", "color", "lamination", "quantityKg"];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { ok: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // Calculate price
    const pricing = calculatePrice({
      sizeInches: Number(body.sizeInches),
      grammage: Number(body.grammage),
      quality: String(body.quality),
      color: String(body.color),
      lamination: String(body.lamination),
      quantityKg: Number(body.quantityKg),
    });
    
    // Log activity
    const db = getDatabase();
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, payload)
      VALUES (?, 'price_calculated', 'api', ?)
    `).run(crypto.randomUUID(), JSON.stringify({ input: body, output: pricing }));
    
    return NextResponse.json({ ok: true, pricing });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Pricing calculation failed" },
      { status: 500 }
    );
  }
}

