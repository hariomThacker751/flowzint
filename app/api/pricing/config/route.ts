import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();
    const config = db.prepare(`
      SELECT * FROM price_config 
      ORDER BY effective_date DESC 
      LIMIT 1
    `).get();
    
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get price config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate that all quality grade prices are provided
    const requiredFields = ['basePriceJanta', 'basePriceRegular', 'basePriceSilver', 'basePriceGold', 'basePricePlatinum'];
    for (const field of requiredFields) {
      if (!body[field] || typeof body[field] !== "number") {
        return NextResponse.json(
          { ok: false, error: `Invalid ${field}` },
          { status: 400 }
        );
      }
    }
    
    const db = getDatabase();
    const id = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO price_config (
        id, base_price_janta, base_price_regular, base_price_silver, 
        base_price_gold, base_price_platinum, created_by, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.basePriceJanta,
      body.basePriceRegular,
      body.basePriceSilver,
      body.basePriceGold,
      body.basePricePlatinum,
      body.createdBy || "owner",
      body.notes || ""
    );
    
    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, payload)
      VALUES (?, 'price_config_updated', ?, ?)
    `).run(
      crypto.randomUUID(),
      body.createdBy || "owner",
      JSON.stringify({ 
        janta: body.basePriceJanta,
        regular: body.basePriceRegular,
        silver: body.basePriceSilver,
        gold: body.basePriceGold,
        platinum: body.basePricePlatinum,
        notes: body.notes 
      })
    );
    
    const config = db.prepare("SELECT * FROM price_config WHERE id = ?").get(id);
    
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update price config" },
      { status: 500 }
    );
  }
}

