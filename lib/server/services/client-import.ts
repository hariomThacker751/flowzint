import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { getDatabase } from "../database";

/**
 * Client profile import (Implementation Spec §5, Layer 1).
 *
 * Imports the existing clients from the GST client-portal export. The xlsx is
 * pre-parsed to `data/seed/clients.json` (avoids a runtime xlsx dependency);
 * re-parse with the bundled python script if the source sheet changes. The
 * import is idempotent — matched on GSTIN (or phone) it updates rather than
 * duplicates.
 */

export type SeedClient = {
  gst_number: string | null;
  state_code: string | null;
  business_name: string | null;
  promoter_name: string | null;
  promoters: string | null;
  principal_address: string | null;
  email: string | null;
  phone: string | null;
  nature_of_business: string | null;
  branch_addresses: Array<{ address?: string; email?: string; mobile?: unknown; nature?: string }>;
};

/** Pull city / state / pincode out of a trailing "…, City, State, 141010" address. */
function parseAddress(address: string | null): { city: string | null; state: string | null; pincode: string | null } {
  if (!address) return { city: null, state: null, pincode: null };
  const pin = address.match(/\b(\d{6})\b/);
  const pincode = pin ? pin[1] : null;
  const parts = address
    .replace(/\b\d{6}\b/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const state = parts.length >= 1 ? parts[parts.length - 1] : null;
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  return { city, state, pincode };
}

export type ImportResult = { imported: number; updated: number; total: number };

export function importClientsFromSeed(seedPath?: string): ImportResult {
  const file = seedPath || path.join(process.cwd(), "data", "seed", "clients.json");
  if (!existsSync(file)) throw new Error(`Client seed not found: ${file}`);
  const clients = JSON.parse(readFileSync(file, "utf8")) as SeedClient[];

  const db = getDatabase();
  let imported = 0;
  let updated = 0;

  const tx = db.transaction(() => {
    for (const c of clients) {
      const phone = (c.phone || "").replace(/[^\d]/g, "");
      const { city, state, pincode } = parseAddress(c.principal_address);
      const existing = db
        .prepare(`SELECT id FROM customers WHERE (gst_number = ? AND gst_number IS NOT NULL) OR (phone = ? AND ? != '')`)
        .get(c.gst_number, phone, phone) as { id: string } | undefined;

      const fields = {
        name: c.business_name || c.promoter_name || "Unknown",
        company: c.business_name,
        business_name: c.business_name,
        promoter_name: c.promoter_name,
        principal_address: c.principal_address,
        gst_number: c.gst_number,
        state_code: c.state_code,
        city,
        state,
        pincode,
        email: c.email,
        nature_of_business: c.nature_of_business,
        branch_addresses: c.branch_addresses?.length ? JSON.stringify(c.branch_addresses) : null,
      };

      if (existing) {
        db.prepare(
          `UPDATE customers SET name=COALESCE(?,name), company=?, business_name=?, promoter_name=?, principal_address=?,
             gst_number=COALESCE(?,gst_number), state_code=?, city=?, state=?, pincode=?, email=COALESCE(?,email),
             nature_of_business=?, branch_addresses=?, updated_at=datetime('now') WHERE id=?`
        ).run(
          fields.name, fields.company, fields.business_name, fields.promoter_name, fields.principal_address,
          fields.gst_number, fields.state_code, fields.city, fields.state, fields.pincode, fields.email,
          fields.nature_of_business, fields.branch_addresses, existing.id
        );
        updated++;
      } else {
        db.prepare(
          `INSERT INTO customers
            (id, phone, name, company, business_name, promoter_name, principal_address, gst_number, state_code,
             city, state, pincode, email, nature_of_business, branch_addresses, language, stage)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hindi', 'greeting')`
        ).run(
          crypto.randomUUID(), phone || `imported-${crypto.randomUUID().slice(0, 8)}`, fields.name, fields.company,
          fields.business_name, fields.promoter_name, fields.principal_address, fields.gst_number, fields.state_code,
          fields.city, fields.state, fields.pincode, fields.email, fields.nature_of_business, fields.branch_addresses
        );
        imported++;
      }
    }
  });
  tx();

  return { imported, updated, total: clients.length };
}
