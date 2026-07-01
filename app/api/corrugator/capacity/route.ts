import { NextResponse } from "next/server";
import { getAllMonthlyCapacities, getMonthlyCapacity, MONTHLY_CAPACITY_KG, TOTAL_LOOMS, KG_PER_LOOM_PER_DAY } from "@/lib/server/corrugator-capacity";
import { getBookingMonths } from "@/lib/server/corrugator-capacity";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");

    if (monthParam) {
      const cap = getMonthlyCapacity(monthParam);
      return NextResponse.json({
        success: true,
        capacity: cap,
        constants: { totalCorrugators: TOTAL_LOOMS, kgPerCorrugatorPerDay: KG_PER_LOOM_PER_DAY, monthlyCapacityKg: MONTHLY_CAPACITY_KG },
      });
    }

    const capacities = getAllMonthlyCapacities();
    const months = getBookingMonths();

    return NextResponse.json({
      success: true,
      capacities,
      bookingMonths: months,
      constants: { totalCorrugators: TOTAL_LOOMS, kgPerCorrugatorPerDay: KG_PER_LOOM_PER_DAY, monthlyCapacityKg: MONTHLY_CAPACITY_KG },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

