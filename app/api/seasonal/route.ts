import { NextResponse } from "next/server";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { getSeasonalDimension, monthsToLabel } from "@/lib/server/services/demand";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager", "accounts"];

/**
 * GET /api/seasonal?dimension=client|size|quality|region
 * Returns the materialized seasonal-demand aggregate for a dimension, with
 * month numbers and friendly labels for the dashboard heatmap.
 */
export async function GET(req: Request) {
  try {
    assertRole(req, ALLOWED);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dimension = (url.searchParams.get("dimension") || "client").toLowerCase();
  if (!["client", "size", "quality", "region"].includes(dimension)) {
    return NextResponse.json({ error: "dimension must be client|size|quality|region" }, { status: 400 });
  }
  const rows = getSeasonalDimension(dimension).map((r) => ({
    label: r.dimension_value,
    state: r.state || null,
    peakMonths: (r.peak_months ? String(r.peak_months).split(",").map(Number) : []) as number[],
    peakMonthsLabel: monthsToLabel(r.peak_months),
    typicalKg: r.typical_quantity_kg ?? null,
  }));
  return NextResponse.json({ ok: true, dimension, rows });
}

