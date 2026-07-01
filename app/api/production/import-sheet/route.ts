import { NextResponse } from "next/server";
import { assertRole, AuthError, type Role } from "@/lib/server/auth";
import { appendLog } from "@/lib/server/store";
import { XlsxBufferSource, ingestProductionSheet } from "@/lib/server/services/sheet-ingest";
import { processOutbox } from "@/lib/server/services/outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED: Role[] = ["owner", "dev", "manager"];

/**
 * POST /api/production/import-sheet — upload the daily production .xlsx.
 * Multipart form: field `file` (.xlsx), optional `tab` (default Production_Daily).
 * Runs the import→validate→map→process pipeline, then flushes queued native
 * customer alerts. Idempotent per file content.
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
    const form = await req.formData();
    const file = form.get("file");
    const tab = (form.get("tab") as string) || "Production_Daily";
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "Multipart field 'file' (.xlsx) is required" }, { status: 400 });
    }
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const filename = (file as File).name || "production.xlsx";

    const source = new XlsxBufferSource(buffer, filename, tab);
    const result = await ingestProductionSheet(source, actor);

    // Flush queued native-language alerts (T17/T18) generated during processing.
    const flushed = result.alreadyProcessed ? { sent: 0, failed: 0 } : await processOutbox(100);

    await appendLog("sheet_imported", { ...result, flushed, by: actor });
    return NextResponse.json({ ok: true, ...result, flushed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

