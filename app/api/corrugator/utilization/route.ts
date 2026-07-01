import { NextResponse } from "next/server";
import { getCorrugatorGrid, getMonthlyCapacity, TOTAL_LOOMS, MONTHLY_CAPACITY_KG, KG_PER_LOOM_PER_DAY } from "@/lib/server/corrugator-capacity";
import { monthKey } from "@/lib/server/corrugator-capacity";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month") || monthKey();

    const grid = getCorrugatorGrid(monthParam);
    const capacity = getMonthlyCapacity(monthParam);

    const summary = {
      totalCorrugators: TOTAL_LOOMS,
      availableCorrugators: grid.filter(l => l.status === "available").length,
      partiallyBookedCorrugators: grid.filter(l => l.status === "partially_booked").length,
      fullyBookedCorrugators: grid.filter(l => l.status === "fully_booked").length,
      capacity,
    };

    return NextResponse.json({ success: true, month: monthParam, grid, summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

