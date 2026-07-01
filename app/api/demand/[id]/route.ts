import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { getProfile, deriveProfile, monthsToLabel } from "@/lib/server/services/demand";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/** GET /api/demand/[customerId] — full demand profile + recent declared signals. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const { id } = await ctx.params;
  // Refresh derived fields on read so the profile is always current.
  deriveProfile(id);
  const profile = getProfile(id);
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });
  const signals = getDatabase()
    .prepare(`SELECT kind, raw_text, language, confidence, source, created_at FROM demand_signals WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20`)
    .all(id);
  return NextResponse.json({
    ok: true,
    profile: {
      ...profile,
      peakMonthsLabel: monthsToLabel(profile.peak_months),
      derivedPeakMonthsLabel: monthsToLabel(profile.derived_peak_months),
      lowMonthsLabel: monthsToLabel(profile.low_months),
      attributes: (() => { try { return JSON.parse(profile.attributes || "{}"); } catch { return {}; } })(),
    },
    signals,
  });
}
