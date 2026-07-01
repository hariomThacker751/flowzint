import type Database from "better-sqlite3";
import { getDatabase } from "../database";

/**
 * Atomically allocate the next number in a named, period-scoped sequence.
 * Used for order numbers (ORD-YYYY-NNNN) and PI numbers (PI-YYYYMMDD-NNN).
 *
 * Must be called inside a transaction by the caller when the allocation has to
 * be atomic with the row that consumes it. The UPSERT itself is atomic per call.
 */
export function nextSequence(name: string, periodKey: string, db: Database.Database = getDatabase()): number {
  const row = db
    .prepare(
      `INSERT INTO sequences (name, period_key, last_seq) VALUES (?, ?, 1)
       ON CONFLICT(name, period_key) DO UPDATE SET last_seq = last_seq + 1
       RETURNING last_seq`
    )
    .get(name, periodKey) as { last_seq: number };
  return row.last_seq;
}
