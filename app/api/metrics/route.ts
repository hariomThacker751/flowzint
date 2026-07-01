import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { getAllMonthlyCapacities, monthKey } from "@/lib/server/corrugator-capacity";

export const runtime = "nodejs";

/**
 * /api/metrics — the SINGLE source of truth for Vision OS KPIs.
 *
 * Replaces the scattered per-surface KPI math (the inline CommandCenter cards,
 * components/dashboard/kpi-cards.tsx, and the sidebar nav-badge arithmetic).
 * Every <MetricCard> reads from here so the same number is computed once and
 * displayed consistently everywhere.
 *
 * NOTE (tech debt, tracked in docs/VISION_OS_PLAN.md Phase E): this currently
 * reads the LEGACY tables (enquiries / quotes / corrugator_bookings) to stay
 * consistent with the existing dashboard. After the data-model consolidation it
 * will read the unified `orders` aggregate.
 */
export async function GET() {
  try {
    const db = getDatabase();

    const activeConversations = (db.prepare(`
      SELECT COUNT(DISTINCT customer_id) AS c FROM chat_messages
      WHERE channel = 'customer_whatsapp' AND created_at >= datetime('now','-24 hours')
    `).get() as { c: number }).c;

    const todayQuotes = db.prepare(`
      SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS total
      FROM quotes WHERE created_at >= date('now')
    `).get() as { c: number; total: number };

    const revenuePipeline = (db.prepare(`
      SELECT COALESCE(SUM(total_amount),0) AS total FROM quotes
      WHERE created_at >= datetime('now','-30 days')
    `).get() as { total: number }).total;

    const tokensPending = (db.prepare(`
      SELECT COUNT(*) AS c FROM enquiries WHERE status = 'awaiting_payment'
    `).get() as { c: number }).c;

    const pendingEscalations = (db.prepare(`
      SELECT COUNT(*) AS c FROM pending_escalations WHERE status = 'pending'
    `).get() as { c: number }).c;

    // Production utilization from the corrugator-capacity service (current month).
    let corrugatorUtilization = 0;
    try {
      const caps = getAllMonthlyCapacities();
      const cur = caps.find((c: any) => c.monthKey === monthKey()) || caps[0];
      if (cur) corrugatorUtilization = cur.utilizationPct || 0;
    } catch {
      /* capacity service optional */
    }

    const pendingDecisions = tokensPending + pendingEscalations;

    // Stable, typed metric contract consumed by <MetricCard>.
    const metrics = [
      { id: "active_conversations", label: "Active Conversations", value: String(activeConversations), delta: "Last 24h", tone: "cyan", icon: "MessageCircle" },
      { id: "orders_today", label: "Quotes Today", value: String(todayQuotes.c), delta: `₹${(todayQuotes.total / 100000).toFixed(1)}L`, tone: "violet", icon: "FileText" },
      { id: "production_utilization", label: "Production Utilization", value: `${corrugatorUtilization}%`, delta: "Today", tone: "green", icon: "Factory" },
      { id: "revenue_pipeline", label: "Revenue Pipeline", value: `₹${(revenuePipeline / 100000).toFixed(1)}L`, delta: "30 days", tone: "amber", icon: "Database" },
      { id: "tokens_pending", label: "Tokens Pending", value: String(tokensPending), delta: "Awaiting", tone: tokensPending > 0 ? "amber" : "green", icon: "Clock3" },
      { id: "pending_decisions", label: "Need Your Decision", value: String(pendingDecisions), delta: pendingDecisions > 0 ? "Action" : "Clear", tone: pendingDecisions > 0 ? "red" : "green", icon: "AlertTriangle" },
    ];

    return NextResponse.json({ ok: true, metrics, pendingDecisions });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "metrics failed" },
      { status: 500 },
    );
  }
}

