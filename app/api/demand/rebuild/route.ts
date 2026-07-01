import { NextResponse } from "next/server";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { deriveAllProfiles, rebuildSeasonalAggregates } from "@/lib/server/services/demand";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";
const ALLOWED: Role[] = ["owner", "dev", "manager"];

/**
 * POST /api/demand/rebuild — manually re-derive all demand profiles and rebuild
 * the seasonal aggregates (also runs nightly via the job runner).
 */
export async function POST(req: Request) {
  let actor: string;
  try {
    actor = assertRole(req, ALLOWED).name;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  try {
    const profiles = deriveAllProfiles();
    const { rows } = rebuildSeasonalAggregates();
    await appendLog("demand_rebuild", { profiles, seasonalRows: rows, by: actor });
    return NextResponse.json({ ok: true, profiles, seasonalRows: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

