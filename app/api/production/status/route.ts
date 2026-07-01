import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { TOTAL_CORRUGATORS, KG_PER_CORRUGATOR_PER_DAY, MONTHLY_CAPACITY_KG, getAllMonthlyCapacities, getBookingMonths, getMonthlyCapacity } from "@/lib/server/corrugator-capacity";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();

    // ── Today's production stats ──
    const today = new Date().toISOString().split('T')[0];

    // Get today's production record (total produced across all corrugators)
    const todayProd = db.prepare(`
      SELECT COALESCE(SUM(booked_kg), 0) as booked, COALESCE(SUM(available_kg), 0) as available
      FROM production_capacity WHERE date = ?
    `).get(today) as { booked: number; available: number };

    const dailyTarget = TOTAL_CORRUGATORS * KG_PER_CORRUGATOR_PER_DAY; // 6,750 kg/day
    const producedToday = todayProd?.booked || 0;

    // ── Active corrugator bookings (in production) ──
    const activeBookings = db.prepare(`
      SELECT lb.*, e.size_inches, e.grammage, e.quality, e.color, e.lamination,
             e.quantity_kg, e.status as enquiry_status, e.delivery_city,
             c.name as customer_name, c.phone as customer_phone,
             COALESCE(q.total_amount, 0) as quote_amount
      FROM corrugator_bookings lb
      JOIN enquiries e ON lb.enquiry_id = e.id
      JOIN customers c ON lb.customer_id = c.id
      LEFT JOIN quotes q ON e.id = q.enquiry_id
      WHERE lb.status IN ('booked', 'in_production', 'producing')
      ORDER BY lb.created_at DESC
    `).all() as any[];

    // ── Calculate active corrugators & allocation ──
    let activeCorrugators = 0;
    const corrugatorAllocations: Array<{
      corrugatorStart: number;
      corrugatorEnd: number;
      customerName: string;
      enquiryId: string;
      specs: string;
      kgBooked: number;
      kgPerDay: number;
      deliveryEstimateDays: number;
      status: string;
      progressPct: number;
      quoteAmount: number;
    }> = [];

    for (const b of activeBookings) {
      const corrugatorsNeeded = Math.max(1, Math.ceil((b.kg_per_day || KG_PER_CORRUGATOR_PER_DAY) / KG_PER_CORRUGATOR_PER_DAY));
      const startCorrugator = activeCorrugators + 1;
      const endCorrugator = Math.min(TOTAL_CORRUGATORS, activeCorrugators + corrugatorsNeeded);
      activeCorrugators = endCorrugator;

      // Calculate progress: days elapsed vs estimated days
      const startDate = b.production_started_at ? new Date(b.production_started_at) : new Date(b.created_at);
      const daysElapsed = Math.max(0, (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = b.delivery_estimate_days || 7;
      const progressPct = Math.min(98, Math.round((daysElapsed / totalDays) * 100));

      corrugatorAllocations.push({
        corrugatorStart: startCorrugator,
        corrugatorEnd: endCorrugator,
        customerName: b.customer_name || "Unknown",
        enquiryId: b.enquiry_id,
        specs: `${b.size_inches}" ${b.grammage}g ${b.quality}`,
        kgBooked: b.kg_booked,
        kgPerDay: b.kg_per_day || KG_PER_CORRUGATOR_PER_DAY,
        deliveryEstimateDays: b.delivery_estimate_days || 7,
        status: b.status,
        progressPct,
        quoteAmount: b.quote_amount || 0,
      });

      if (activeCorrugators >= TOTAL_CORRUGATORS) break;
    }

    const idleCorrugators = Math.max(0, TOTAL_CORRUGATORS - activeCorrugators);
    const efficiencyPct = dailyTarget > 0 ? Math.round((producedToday / dailyTarget) * 100) : 0;

    // ── Build corrugator grid (45 corrugators) ──
    const corrugators = [];
    for (let i = 1; i <= TOTAL_CORRUGATORS; i++) {
      const allocation = corrugatorAllocations.find(a => i >= a.corrugatorStart && i <= a.corrugatorEnd);
      corrugators.push({
        id: i,
        status: allocation ? (allocation.status === 'in_production' ? 'running' : 'allocated') : 'idle',
        customerName: allocation?.customerName || null,
        specs: allocation?.specs || null,
        enquiryId: allocation?.enquiryId || null,
        progressPct: allocation?.progressPct || 0,
      });
    }

    // ── Production queue (all orders by status) ──
    const productionQueue = db.prepare(`
      SELECT e.*, c.name as customer_name, c.phone as customer_phone,
             COALESCE(q.total_amount, 0) as quote_amount,
             lb.status as booking_status, lb.kg_booked as booked_kg,
             lb.delivery_estimate_days, lb.kg_per_day
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN quotes q ON e.id = q.enquiry_id
      LEFT JOIN corrugator_bookings lb ON e.id = lb.enquiry_id
      WHERE e.status IN ('awaiting_payment', 'in_production', 'complete', 'delivered')
      ORDER BY
        CASE e.status
          WHEN 'in_production' THEN 1
          WHEN 'awaiting_payment' THEN 2
          WHEN 'complete' THEN 3
          WHEN 'delivered' THEN 4
        END,
        e.created_at DESC
      LIMIT 30
    `).all() as any[];

    // ── Monthly capacity ──
    let monthlyCapacity = { bookedKg: 0, availableKg: MONTHLY_CAPACITY_KG, utilizationPct: 0 };
    try {
      const caps = getAllMonthlyCapacities();
      if (caps.length > 0) {
        monthlyCapacity = {
          bookedKg: caps[0].bookedKg || 0,
          availableKg: caps[0].availableKg || MONTHLY_CAPACITY_KG,
          utilizationPct: caps[0].utilizationPct || 0,
        };
      }
    } catch (_) {}

    // ── Delivery calendar (next 7 days) ──
    const deliveries = db.prepare(`
      SELECT e.id, c.name as customer_name, e.size_inches, e.grammage, e.quality,
             e.quantity_kg, e.delivery_city, lb.delivery_estimate_days,
             lb.production_started_at, e.status
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN corrugator_bookings lb ON e.id = lb.enquiry_id
      WHERE e.status = 'in_production'
      ORDER BY lb.delivery_estimate_days ASC
      LIMIT 10
    `).all() as any[];

    const deliveryCalendar = deliveries.map(d => {
      const startDate = d.production_started_at ? new Date(d.production_started_at) : new Date();
      const deliveryDate = new Date(startDate);
      deliveryDate.setDate(deliveryDate.getDate() + (d.delivery_estimate_days || 7));
      return {
        enquiryId: d.id,
        customerName: d.customer_name,
        specs: `${d.size_inches}" ${d.grammage}g ${d.quality}`,
        quantityKg: d.quantity_kg,
        deliveryDate: deliveryDate.toISOString().split('T')[0],
        daysLeft: Math.max(0, d.delivery_estimate_days || 7),
      };
    });

    return NextResponse.json({
      ok: true,
      production: {
        // Today's KPIs
        today: {
          producedKg: producedToday,
          targetKg: dailyTarget,
          activeCorrugators,
          idleCorrugators,
          totalCorrugators: TOTAL_CORRUGATORS,
          efficiencyPct,
        },
        // Corrugator grid
        corrugators,
        // Active batches
        activeBatches: corrugatorAllocations,
        // Production queue
        queue: productionQueue.map((q: any) => ({
          id: q.id,
          customerName: q.customer_name || "Unknown",
          customerPhone: q.customer_phone,
          sizeInches: q.size_inches,
          grammage: q.grammage,
          quality: q.quality,
          color: q.color,
          lamination: q.lamination,
          quantityKg: q.quantity_kg,
          deliveryCity: q.delivery_city,
          status: q.status,
          bookingStatus: q.booking_status,
          quoteAmount: q.quote_amount || 0,
          bookedKg: q.booked_kg || 0,
          deliveryEstimateDays: q.delivery_estimate_days,
          kgPerDay: q.kg_per_day,
        })),
        // Monthly capacity
        monthly: monthlyCapacity,
        // Delivery calendar
        deliveryCalendar,
      },
    });
  } catch (error) {
    console.error("Production status error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get production status" },
      { status: 500 }
    );
  }
}

