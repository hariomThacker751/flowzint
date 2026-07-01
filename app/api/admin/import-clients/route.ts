import { NextResponse } from "next/server";
import { assertRole, AuthError } from "@/lib/server/auth";
import { importClientsFromSeed } from "@/lib/server/services/client-import";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

/** POST /api/admin/import-clients — import the GST client portal (owner only). */
export async function POST(req: Request) {
  let actor: string;
  try {
    actor = assertRole(req, ["owner"]).name;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }
  try {
    const result = importClientsFromSeed();
    await appendLog("clients_imported", { ...result, by: actor });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

