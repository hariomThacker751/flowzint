import { NextResponse } from "next/server";
import { getCapacityForDate, updateCapacity, getCapacityRange } from "@/lib/server/capacity-manager";
import { getDatabase } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    
    if (startDate && endDate) {
      const capacity = getCapacityRange(startDate, endDate);
      return NextResponse.json({ ok: true, capacity });
    } else if (date) {
      const capacity = getCapacityForDate(date);
      return NextResponse.json({ ok: true, capacity });
    } else {
      return NextResponse.json(
        { ok: false, error: "Missing date or startDate/endDate parapieces" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get capacity" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.date || !body.sizeInches || !body.grammage || !body.plannedKg) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: date, sizeInches, grammage, plannedKg" },
        { status: 400 }
      );
    }
    
    const id = updateCapacity(
      body.date,
      Number(body.sizeInches),
      Number(body.grammage),
      Number(body.plannedKg)
    );
    
    // Log activity
    const db = getDatabase();
    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, payload)
      VALUES (?, 'capacity_updated', 'owner', ?)
    `).run(
      crypto.randomUUID(),
      JSON.stringify({ date: body.date, sizeInches: body.sizeInches, grammage: body.grammage, plannedKg: body.plannedKg })
    );
    
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update capacity" },
      { status: 500 }
    );
  }
}

