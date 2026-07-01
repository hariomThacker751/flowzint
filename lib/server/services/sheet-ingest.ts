import crypto from "node:crypto";
import { getDatabase } from "../database";
import { readXlsxSheet, type ParsedSheet } from "./xlsx-reader";
import { recordDailyKg, markBatchComplete } from "./production";
import { enqueue } from "./outbox";

/**
 * Daily production-sheet ingestion (Phase 4 — requirement #2).
 *
 * Pipeline: import → validate → map → process → audit. Designed to be the
 * permanent home for the daily production data regardless of where it comes
 * from. Today the source is an uploaded .xlsx; a `GoogleSheetSource` adapter
 * drops into the SAME pipeline later with zero workflow change — only the
 * `SheetSource.read()` implementation differs.
 *
 * Processing feeds the existing ETA engine (`recordDailyKg`) and enqueues the
 * native-language T17/T18 customer messages where warranted.
 */

// ── Source port (ports & adapters) ──────────────────────────────────────────

export interface SheetSource {
  readonly kind: "xlsx_upload" | "google_sheet" | "csv";
  readonly name: string;
  read(): Promise<ParsedSheet>;
  /** Stable hash of the underlying content, for idempotency. */
  contentHash(): string;
}

export class XlsxBufferSource implements SheetSource {
  readonly kind = "xlsx_upload" as const;
  constructor(private buffer: Buffer, public readonly name: string, private tab = "Production_Daily") {}
  async read(): Promise<ParsedSheet> {
    return readXlsxSheet(this.buffer, this.tab);
  }
  contentHash(): string {
    return crypto.createHash("sha256").update(this.buffer).digest("hex");
  }
}

/**
 * Placeholder adapter for live Google Sheets. Implement `read()` with the
 * Sheets API (service account) when credentials are provisioned; the pipeline
 * below needs no changes.
 */
export class GoogleSheetSource implements SheetSource {
  readonly kind = "google_sheet" as const;
  readonly name = "Production_Daily (Google Sheet)";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private spreadsheetId: string, private tab = "Production_Daily") {}
  async read(): Promise<ParsedSheet> {
    throw new Error("GoogleSheetSource not configured — provide a service account and implement read()");
  }
  contentHash(): string {
    return `google:${this.spreadsheetId}:${new Date().toISOString().slice(0, 10)}`;
  }
}

// ── Column resolution (tolerant header matching) ─────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ["date", "prod_date", "production_date"],
  batchId: ["batch_id", "batch", "batch no", "batch_no"],
  orderId: ["order_id", "order", "order no", "order_no"],
  actualKg: ["actual_kg_today", "actual_kg", "actual kg today", "kg_today", "actual"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function resolveColumns(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [canon, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.map(norm).includes(n)) map[canon] = i;
    }
  });
  return map;
}

function normalizeDate(raw: string): string | null {
  const s = (raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Excel serial date number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 59) {
      const ms = (serial - 25569) * 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  return null;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export type RowError = { row: number; reason: string };
export type IngestResult = {
  importId: string;
  source: string;
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  rowsProcessed: number;
  alertsQueued: number;
  completions: number;
  errors: RowError[];
  alreadyProcessed?: boolean;
};

const MAX_KG_PER_DAY = 500; // Impl Spec §4.3 data validation (Col H, 0–500)

export async function ingestProductionSheet(source: SheetSource, importedBy: string): Promise<IngestResult> {
  const db = getDatabase();
  const hash = source.contentHash();

  // Idempotency: a file with the same content is processed once.
  const prior = db.prepare(`SELECT id FROM sheet_imports WHERE content_hash = ?`).get(hash) as { id: string } | undefined;
  if (prior) {
    return {
      importId: prior.id, source: source.kind, rowsTotal: 0, rowsValid: 0, rowsInvalid: 0,
      rowsProcessed: 0, alertsQueued: 0, completions: 0, errors: [], alreadyProcessed: true,
    };
  }

  const sheet = await source.read();
  const rows = sheet.rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  if (!rows.length) throw new Error("Sheet is empty");

  const header = rows[0];
  const cols = resolveColumns(header);
  if (cols.actualKg === undefined || (cols.batchId === undefined && cols.orderId === undefined)) {
    throw new Error("Sheet missing required columns: Actual_KG_Today and Batch_ID/Order_ID");
  }

  const errors: RowError[] = [];
  let rowsValid = 0;
  let rowsProcessed = 0;
  let alertsQueued = 0;
  let completions = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 1;
    const batchIdVal = cols.batchId !== undefined ? String(r[cols.batchId] || "").trim() : "";
    const orderIdVal = cols.orderId !== undefined ? String(r[cols.orderId] || "").trim() : "";
    const kgRaw = String(r[cols.actualKg] ?? "").trim();
    const dateRaw = cols.date !== undefined ? String(r[cols.date] || "").trim() : "";

    // Validate
    const kg = Number(kgRaw);
    if (kgRaw === "" || !Number.isFinite(kg)) { errors.push({ row: rowNo, reason: "Actual_KG_Today is not a number" }); continue; }
    if (kg < 0 || kg > MAX_KG_PER_DAY) { errors.push({ row: rowNo, reason: `Actual_KG_Today ${kg} out of range 0–${MAX_KG_PER_DAY}` }); continue; }
    const prodDate = dateRaw ? normalizeDate(dateRaw) : new Date().toISOString().slice(0, 10);
    if (!prodDate) { errors.push({ row: rowNo, reason: `Unparseable date '${dateRaw}'` }); continue; }

    // Map to a batch
    const batch = (batchIdVal
      ? db.prepare(`SELECT * FROM production_batches WHERE batch_no = ?`).get(batchIdVal)
      : db
          .prepare(`SELECT b.* FROM production_batches b JOIN orders o ON b.order_id = o.id WHERE o.order_no = ?`)
          .get(orderIdVal)) as any;
    if (!batch) { errors.push({ row: rowNo, reason: `No batch for ${batchIdVal || orderIdVal}` }); continue; }

    rowsValid++;

    // Process through the ETA engine
    const result = recordDailyKg(batch.id, prodDate, kg, importedBy);
    rowsProcessed++;

    const ctx = db
      .prepare(
        `SELECT o.order_no, c.id AS customer_id, c.name AS customer_name, c.phone, c.language, b.spec, b.order_qty_kg, b.original_eta
         FROM production_batches b JOIN orders o ON b.order_id = o.id JOIN customers c ON b.customer_id = c.id WHERE b.id = ?`
      )
      .get(batch.id) as any;

    if (result.etaShiftedDays > 1 && ctx?.phone) {
      enqueue({
        phone: ctx.phone,
        customerId: ctx.customer_id,
        templateId: "T17",
        customerLanguage: ctx.language,
        vars: { CLIENT_NAME: ctx.customer_name || "", ORDER_ID: ctx.order_no, REASON: "production pace", OLD_ETA: ctx.original_eta || "", NEW_ETA: result.batch.revised_eta || "" },
        dedupKey: `${batch.id}:T17:${prodDate}`,
      });
      alertsQueued++;
    }
    if (result.reachedDispatchWindow && ctx?.phone) {
      enqueue({
        phone: ctx.phone,
        customerId: ctx.customer_id,
        templateId: "T18",
        customerLanguage: ctx.language,
        vars: { CLIENT_NAME: ctx.customer_name || "", ORDER_ID: ctx.order_no, SPEC: ctx.spec || "", QTY: `${ctx.order_qty_kg}kg`, DISPATCH_DATE: result.batch.revised_eta || "" },
        dedupKey: `${batch.id}:T18`,
      });
      alertsQueued++;
    }
    if (result.completed) {
      markBatchComplete(batch.id, importedBy);
      completions++;
    }
  }

  const importId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sheet_imports
      (id, source, filename, sheet_tab, content_hash, rows_total, rows_valid, rows_invalid, rows_processed, status, errors_json, imported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    importId, source.kind, source.name, sheet.name, hash,
    rows.length - 1, rowsValid, errors.length, rowsProcessed,
    errors.length === 0 ? "processed" : "processed_with_errors",
    errors.length ? JSON.stringify(errors) : null, importedBy
  );

  return {
    importId, source: source.kind, rowsTotal: rows.length - 1, rowsValid, rowsInvalid: errors.length,
    rowsProcessed, alertsQueued, completions, errors,
  };
}
