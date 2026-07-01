import { NextResponse } from "next/server";
import { getCorrugatorFloorConfig, updateCorrugatorFloorConfig, calculateEta, getMonthlyCapacity, getBookingMonths } from "@/lib/server/corrugator-capacity";

export const runtime = "nodejs";

/**
 * GET /api/corrugator
 * Returns the live corrugator floor (digital twin): how many corrugators are free,
 * maintenance, external, and in-system — plus the derived monthly capacity
 * and the per-corrugator KB output for a requested spec (if passed).
 *
 * Query params:
 *   eta=1&size=36&grammage=3.5&quality=Silver&qty=1000  → live ETA + dispatch
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const floor = getCorrugatorFloorConfig();
  const months = getBookingMonths().map((mk) => getMonthlyCapacity(mk));

  const wantEta = url.searchParams.get("eta") === "1";
  const size = url.searchParams.get("size");
  const grammage = url.searchParams.get("grammage");
  const quality = url.searchParams.get("quality");
  const qty = url.searchParams.get("qty");

  let eta = null;
  if (wantEta && size && grammage && quality && qty) {
    eta = calculateEta(Number(qty), {
      sizeInches: Number(size),
      grammage: Number(grammage),
      quality,
    });
  }

  return NextResponse.json({
    ok: true,
    floor,
    monthlyCapacity: months,
    eta,
  });
}

/**
 * POST /api/corrugator
 * Owner / Director updates the live corrugator floor.
 * Body: { corrugators_available?, corrugators_maintenance?, corrugators_external?, updated_by?, notes? }
 *
 * Example (owner takes an external order): tell Director "5 corrugators busy with offline order"
 *   → POST { corrugators_external: <previous+5>, corrugators_available: <previous-5>, updated_by: "Puneet" }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const updated = updateCorrugatorFloorConfig({
    corrugators_available: typeof body.corrugators_available === "number" ? body.corrugators_available : undefined,
    corrugators_maintenance: typeof body.corrugators_maintenance === "number" ? body.corrugators_maintenance : undefined,
    corrugators_external: typeof body.corrugators_external === "number" ? body.corrugators_external : undefined,
    updated_by: typeof body.updated_by === "string" ? body.updated_by : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return NextResponse.json({ ok: true, floor: updated });
}


