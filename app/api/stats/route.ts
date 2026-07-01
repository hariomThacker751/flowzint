import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { getAllMonthlyCapacities, MONTHLY_CAPACITY_KG, TOTAL_CORRUGATORS } from "@/lib/server/corrugator-capacity";
import { monthKey } from "@/lib/server/corrugator-capacity";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();

    // ── Active conversations (last 24h) ──
    const activeConversations = db.prepare(`
      SELECT COUNT(DISTINCT customer_id) as count FROM chat_messages
      WHERE channel = 'customer_whatsapp'
      AND created_at >= datetime('now', '-24 hours')
    `).get() as { count: number };

    // ── Today's revenue ──
    const todayQuotes = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
      FROM quotes WHERE created_at >= date('now')
    `).get() as { count: number; total: number };

    // ── Pending escalations ──
    const pendingEscalations = db.prepare(`
      SELECT pe.*, c.name as customer_name, c.phone as customer_phone
      FROM pending_escalations pe
      LEFT JOIN customers c ON pe.customer_id = c.id
      WHERE pe.status = 'pending'
      ORDER BY pe.created_at DESC LIMIT 20
    `).all() as any[];

    // ── Orders by status ──
    const ordersByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM enquiries
      GROUP BY status ORDER BY COUNT(*) DESC
    `).all() as Array<{ status: string; count: number }>;

    // ── Customer pipeline ──
    const customerStages = db.prepare(`
      SELECT stage, COUNT(*) as count FROM customers
      WHERE stage != 'owner'
      GROUP BY stage ORDER BY COUNT(*) DESC
    `).all() as Array<{ stage: string; count: number }>;

    const totalCustomers = db.prepare(
      "SELECT COUNT(*) as count FROM customers WHERE stage != 'owner'"
    ).get() as { count: number };

    // ── Revenue pipeline (30 days) ──
    const pipeline = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM quotes
      WHERE created_at >= datetime('now', '-30 days')
    `).get() as { total: number };

    // ── Corrugator capacity ──
    const currentMonth = monthKey();
    let corrugatorUtilization = 0;
    let availableCapacityKg = MONTHLY_CAPACITY_KG;
    let bookedKg = 0;
    let monthlyCapacities: any[] = [];
    try {
      monthlyCapacities = getAllMonthlyCapacities();
      const currentCap = monthlyCapacities.find((c: any) => c.monthKey === currentMonth) || monthlyCapacities[0];
      if (currentCap) {
        corrugatorUtilization = currentCap.utilizationPct || 0;
        availableCapacityKg = currentCap.availableKg || MONTHLY_CAPACITY_KG;
        bookedKg = currentCap.bookedKg || 0;
      }
    } catch (e) {
      console.error('Corrugator capacity query failed:', e);
    }

    // ── Recent corrugator bookings ──
    const recentBookings = db.prepare(`
      SELECT lb.*, c.name as customer_name, c.phone as customer_phone
      FROM corrugator_bookings lb
      LEFT JOIN customers c ON lb.customer_id = c.id
      WHERE lb.status IN ('booked', 'in_production')
      ORDER BY lb.created_at DESC LIMIT 10
    `).all() as any[];

    // ── Recent activity ──
    const recentActivity = db.prepare(`
      SELECT event_type, actor, payload, created_at, customer_id
      FROM activity_log ORDER BY created_at DESC LIMIT 50
    `).all() as any[];

    // ── Payments awaiting confirmation ──
    const paymentsPending = db.prepare(`
      SELECT e.id as enquiry_id, e.customer_id, c.name as customer_name,
             c.phone as customer_phone, e.quantity_kg, e.quality, e.size_inches,
             e.grammage, e.color, e.lamination, e.delivery_city, e.status, e.created_at
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.status = 'awaiting_payment'
      ORDER BY e.created_at DESC LIMIT 20
    `).all() as any[];

    // ── Today's new customers ──
    const todayCustomers = db.prepare(`
      SELECT COUNT(*) as count FROM customers
      WHERE created_at >= date('now') AND stage != 'owner'
    `).get() as { count: number };

    // ── Quotes pending owner approval ──
    const quotesPendingApproval = db.prepare(`
      SELECT q.*, c.name as customer_name, c.phone as customer_phone,
             e.size_inches, e.grammage, e.quality, e.color, e.lamination,
             e.quantity_kg, e.delivery_city
      FROM quotes q
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN enquiries e ON q.enquiry_id = e.id
      WHERE q.owner_approved = 0
      ORDER BY q.created_at DESC LIMIT 20
    `).all() as any[];

    // ── CHART DATA: 7-day revenue trend ──
    const sevenDayRevenue = db.prepare(`
      SELECT date(created_at) as day, COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as quotes
      FROM quotes
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all() as Array<{ day: string; amount: number; quotes: number }>;

    // ── CHART DATA: 7-day production load ──
    const sevenDayProduction = db.prepare(`
      SELECT date, SUM(booked_kg) as booked, SUM(available_kg) as available, SUM(planned_kg) as planned
      FROM production_capacity
      WHERE date >= date('now') AND date < date('now', '+7 days')
      GROUP BY date
      ORDER BY date ASC
    `).all() as Array<{ date: string; booked: number; available: number; planned: number }>;

    // ── CHART DATA: Pipeline stages with amounts ──
    const pipelineStages = db.prepare(`
      SELECT c.stage, COUNT(*) as customers,
             COALESCE(SUM(e.quantity_kg), 0) as total_kg
      FROM customers c
      LEFT JOIN enquiries e ON c.id = e.customer_id AND e.status != 'complete'
      WHERE c.stage != 'owner'
      GROUP BY c.stage
      ORDER BY COUNT(*) DESC
    `).all() as Array<{ stage: string; customers: number; total_kg: number }>;

    // ── CHART DATA: Customer acquisition (last 7 days) ──
    const customerAcquisition = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as new_customers
      FROM customers
      WHERE created_at >= datetime('now', '-7 days') AND stage != 'owner'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all() as Array<{ day: string; new_customers: number }>;

    // ── CHART DATA: Messages per day (last 7 days) ──
    const messagesPerDay = db.prepare(`
      SELECT date(created_at) as day,
             SUM(CASE WHEN role = 'user' OR role = 'customer' THEN 1 ELSE 0 END) as inbound,
             SUM(CASE WHEN role = 'assistant' OR role = 'owner' OR role = 'ravi' THEN 1 ELSE 0 END) as outbound
      FROM chat_messages
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all() as Array<{ day: string; inbound: number; outbound: number }>;

    // ── All enquiries with customer details (for orders table) ──
    const allEnquiries = db.prepare(`
      SELECT e.*, c.name as customer_name, c.phone as customer_phone, c.stage as customer_stage,
             COALESCE(q.total_amount, 0) as quote_amount, q.id as quote_id, q.owner_approved
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN quotes q ON e.id = q.enquiry_id
      GROUP BY e.id
      ORDER BY e.created_at DESC LIMIT 30
    `).all() as any[];

    // ── Knowledge Nodes ──
    const knowledgeNodes = db.prepare(`
      SELECT COUNT(*) as count FROM knowledge_base
    `).get() as { count: number };

    return NextResponse.json({
      ok: true,
      stats: {
        // KPI cards
        todayRevenue: todayQuotes.total,
        todayQuotesAmount: todayQuotes.total, // Added for UI compatibility
        todayQuotesCount: todayQuotes.count,
        activeConversations: activeConversations.count,
        todayCustomers: todayCustomers.count,
        totalCustomers: totalCustomers.count,
        revenuePipeline: pipeline.total,
        knowledgeNodes: knowledgeNodes.count, // Added missing property
        pendingOwnerInputs: pendingEscalations.length, // Added missing property

        // Attention needed
        pendingEscalationsCount: pendingEscalations.length,
        pendingEscalations: pendingEscalations.map((e: any) => ({
          id: e.id,
          customerName: e.customer_name || "Unknown",
          customerPhone: e.customer_phone,
          question: e.question,
          holdingMessage: e.holding_message,
          createdAt: e.created_at,
        })),
        paymentsPendingCount: paymentsPending.length,
        paymentsPending: paymentsPending.map((p: any) => ({
          enquiryId: p.enquiry_id,
          customerName: p.customer_name || "Unknown",
          customerPhone: p.customer_phone,
          quantityKg: p.quantity_kg,
          quality: p.quality,
          sizeInches: p.size_inches,
          grammage: p.grammage,
          color: p.color,
          lamination: p.lamination,
          deliveryCity: p.delivery_city,
          createdAt: p.created_at,
        })),

        // Quotes pending approval
        quotesPendingApprovalCount: quotesPendingApproval.length,
        quotesPendingApproval: quotesPendingApproval.map((q: any) => ({
          id: q.id,
          enquiryId: q.enquiry_id,
          customerName: q.customer_name || "Unknown",
          customerPhone: q.customer_phone,
          unitPrice: q.unit_price,
          totalAmount: q.total_amount,
          sizeInches: q.size_inches,
          grammage: q.grammage,
          quality: q.quality,
          color: q.color,
          lamination: q.lamination,
          quantityKg: q.quantity_kg,
          deliveryCity: q.delivery_city,
          createdAt: q.created_at,
        })),

        // Pipeline
        customerStages,
        ordersByStatus,

        // Production
        corrugatorUtilization,
        availableCapacityKg,
        bookedKg,
        totalMonthlyCapacityKg: MONTHLY_CAPACITY_KG,
        totalCorrugators: TOTAL_CORRUGATORS,
        monthlyCapacities,
        recentBookings: recentBookings.map((b: any) => ({
          id: b.id,
          monthKey: b.month_key,
          customerName: b.customer_name || "Unknown",
          kgBooked: b.kg_booked,
          deliveryEstimateDays: b.delivery_estimate_days,
          status: b.status,
        })),

        // Activity
        recentActivity: recentActivity.map((a: any) => ({
          eventType: a.event_type,
          actor: a.actor,
          payload: tryParseJSON(a.payload),
          createdAt: a.created_at,
        })),

        // Chart data
        chartData: {
          sevenDayRevenue,
          sevenDayProduction,
          pipelineStages,
          customerAcquisition,
          messagesPerDay,
        },

        // Orders table
        allEnquiries: allEnquiries.map((e: any) => ({
          id: e.id,
          customerName: e.customer_name || "Unknown",
          customerPhone: e.customer_phone,
          customerStage: e.customer_stage,
          sizeInches: e.size_inches,
          grammage: e.grammage,
          quality: e.quality,
          color: e.color,
          lamination: e.lamination,
          quantityKg: e.quantity_kg,
          deliveryCity: e.delivery_city,
          status: e.status,
          quoteAmount: e.quote_amount || 0,
          quoteId: e.quote_id,
          ownerApproved: e.owner_approved,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}

function tryParseJSON(s: string | null): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

