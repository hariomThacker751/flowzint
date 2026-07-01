import type Database from "better-sqlite3";

/**
 * Ordered, versioned schema migrations.
 *
 * Why this exists: the original `initializeSchema()` used `CREATE TABLE IF NOT
 * EXISTS` plus ad-hoc `try { ALTER TABLE … } catch {}` blocks. That is not
 * portable, not ordered, and gives no record of what has been applied. This
 * runner records every applied migration in `schema_migrations` and runs each
 * one exactly once, inside a transaction. It is additive and back-compatible
 * with the existing DB created by `initializeSchema()`.
 *
 * To add a migration: append to the MIGRATIONS array with the next integer id.
 * Never edit or reorder an already-shipped migration — add a new one.
 */

type Migration = {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
};

/** Returns true if column `col` already exists on `table`. */
function hasColumn(db: Database.Database, table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === col);
}

function addColumnIfMissing(db: Database.Database, table: string, col: string, ddl: string) {
  if (!hasColumn(db, table, col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "core_sales_os_v3_tables",
    up: (db) => {
      // ── Users & RBAC (Phase 0 auth) ───────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'manager',  -- owner | dev | manager | accounts
          name TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          last_login_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      `);

      // ── Policy / configuration (token range, tax, company, bank) ──────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // ── Orders: the first-class lifecycle aggregate (replaces customer.stage
      //    as the source of truth for order state). One customer → many orders.
      db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          order_no TEXT UNIQUE,              -- ORD-YYYY-NNNN
          customer_id TEXT NOT NULL,
          enquiry_id TEXT,
          quote_id TEXT,
          status TEXT NOT NULL DEFAULT 'quote_pending_approval',
          size_inches INTEGER,
          grammage REAL,
          quality TEXT,
          color TEXT,
          lamination TEXT,
          quantity_kg REAL,
          unit_price REAL,
          total_amount REAL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          confirmed_at TEXT,
          cancelled_at TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no);
      `);

      // ── Order-number daily/yearly sequence + PI sequence ──────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS sequences (
          name TEXT NOT NULL,
          period_key TEXT NOT NULL,   -- e.g. '2026' for orders, '20260624' for PI
          last_seq INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (name, period_key)
        );
      `);

      // ── Proforma Invoices ─────────────────────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          pi_number TEXT UNIQUE NOT NULL,   -- PI-YYYYMMDD-NNN
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          pi_date TEXT NOT NULL,
          valid_until TEXT,
          tax_type TEXT NOT NULL,           -- 'IGST' | 'CGST_SGST'
          hsn_code TEXT NOT NULL,
          taxable_value_paise INTEGER NOT NULL,
          igst_paise INTEGER NOT NULL DEFAULT 0,
          cgst_paise INTEGER NOT NULL DEFAULT 0,
          sgst_paise INTEGER NOT NULL DEFAULT 0,
          grand_total_paise INTEGER NOT NULL,
          grand_total_words TEXT NOT NULL,
          token_min_paise INTEGER NOT NULL,
          token_max_paise INTEGER NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          html_path TEXT,
          pdf_path TEXT,
          sent_client_at TEXT,
          sent_internal_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(pi_number);
      `);

      // ── Payments (token) with mandatory approval stamp ────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          token_amount_paise INTEGER,
          screenshot_ref TEXT,
          status TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | rejected
          approver TEXT,
          approver_role TEXT,
          approved_at TEXT,
          stamp TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      `);

      // ── Generic stamped approvals / audit trail (Guidelines §8) ───────────
      // The legacy initializeSchema() may have already created `approvals` with
      // a different column set (ref_type, ref_id).  We must add the new columns
      // BEFORE creating the composite index on entity_type/entity_id, otherwise
      // the CREATE INDEX will fail on upgraded databases.
      db.exec(`
        CREATE TABLE IF NOT EXISTS approvals (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          approver TEXT NOT NULL,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      // Ensure every column we need exists (safe on both new and legacy tables).
      addColumnIfMissing(db, "approvals", "entity_type", "entity_type TEXT");
      addColumnIfMissing(db, "approvals", "entity_id", "entity_id TEXT");
      addColumnIfMissing(db, "approvals", "approver_role", "approver_role TEXT");
      addColumnIfMissing(db, "approvals", "stamp", "stamp TEXT");
      addColumnIfMissing(db, "approvals", "ref_type", "ref_type TEXT");
      addColumnIfMissing(db, "approvals", "ref_id", "ref_id TEXT");
      addColumnIfMissing(db, "approvals", "customer_name", "customer_name TEXT");
      addColumnIfMissing(db, "approvals", "spec", "spec TEXT");
      // Now the columns exist; create the index safely.
      db.exec(`CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approvals(entity_type, entity_id);`);

      // ── Append-only interaction timeline (Client Profile Layer 3) ─────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS interaction_timeline (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          order_id TEXT,
          event_type TEXT NOT NULL,
          description TEXT NOT NULL,
          triggered_by TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_timeline_customer ON interaction_timeline(customer_id, created_at DESC);
      `);

      // ── Extend pending_escalations with structured trigger + stamp fields ─
      addColumnIfMissing(db, "pending_escalations", "trigger_type", "trigger_type TEXT");
      addColumnIfMissing(db, "pending_escalations", "order_id", "order_id TEXT");
      addColumnIfMissing(db, "pending_escalations", "holding_template", "holding_template TEXT");
      addColumnIfMissing(db, "pending_escalations", "approver", "approver TEXT");
      addColumnIfMissing(db, "pending_escalations", "approved_at", "approved_at TEXT");
      addColumnIfMissing(db, "pending_escalations", "stamp", "stamp TEXT");
      addColumnIfMissing(db, "pending_escalations", "resolution", "resolution TEXT");

      // ── Extend quotes with approval stamp + validity window ───────────────
      addColumnIfMissing(db, "quotes", "approved_by", "approved_by TEXT");
      addColumnIfMissing(db, "quotes", "approval_stamp", "approval_stamp TEXT");
      addColumnIfMissing(db, "quotes", "valid_until", "valid_until TEXT");
      addColumnIfMissing(db, "quotes", "order_id", "order_id TEXT");

      // ── Extend customers with profile/credit fields used by PI + agent ────
      addColumnIfMissing(db, "customers", "business_name", "business_name TEXT");
      addColumnIfMissing(db, "customers", "promoter_name", "promoter_name TEXT");
      addColumnIfMissing(db, "customers", "principal_address", "principal_address TEXT");
      addColumnIfMissing(db, "customers", "pincode", "pincode TEXT");
      addColumnIfMissing(db, "customers", "state_code", "state_code TEXT");
      addColumnIfMissing(db, "customers", "payment_behaviour", "payment_behaviour TEXT DEFAULT 'unknown'");
      addColumnIfMissing(db, "customers", "credit_flag", "credit_flag INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "customers", "credit_flag_reason", "credit_flag_reason TEXT");
    },
  },

  {
    id: 2,
    name: "price_config_effective_date_index",
    up: (db) => {
      // Allow "today's base price" lookups by date. We can't add a UNIQUE
      // constraint to the existing table without a rebuild, so we index the
      // date prefix; the daily-gate query filters on date(effective_date).
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_price_config_date ON price_config(effective_date)`
      );
    },
  },

  {
    id: 3,
    name: "phase3_lifecycle_production_profile",
    up: (db) => {
      // ── Token dunning fields on orders (Guidelines §10.2) ─────────────────
      addColumnIfMissing(db, "orders", "token_deadline", "token_deadline TEXT");
      addColumnIfMissing(db, "orders", "follow_ups_sent", "follow_ups_sent INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "orders", "last_followup_at", "last_followup_at TEXT");

      // ── Production batches (Impl Spec §4 — one batch per order) ────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS production_batches (
          id TEXT PRIMARY KEY,
          batch_no TEXT UNIQUE,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          spec TEXT,
          order_qty_kg REAL NOT NULL,
          target_kg_day REAL NOT NULL,
          cumulative_kg REAL NOT NULL DEFAULT 0,
          remaining_kg REAL NOT NULL,
          pct_complete REAL NOT NULL DEFAULT 0,
          original_eta TEXT,
          revised_eta TEXT,
          eta_status TEXT NOT NULL DEFAULT 'On Track',
          dispatch_alert_sent INTEGER NOT NULL DEFAULT 0,
          corrugator_group TEXT,
          status TEXT NOT NULL DEFAULT 'running',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        CREATE INDEX IF NOT EXISTS idx_batches_order ON production_batches(order_id);
        CREATE INDEX IF NOT EXISTS idx_batches_status ON production_batches(status);
      `);

      // ── Daily production entries (Impl Spec §4 — Production_Daily, one row
      //    per batch per day; Actual_KG_Today is the single manual input) ─────
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_production (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          prod_date TEXT NOT NULL,
          actual_kg REAL NOT NULL,
          entered_by TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(batch_id, prod_date),
          FOREIGN KEY (batch_id) REFERENCES production_batches(id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_prod_batch ON daily_production(batch_id);
      `);

      // ── Dispatch records (Guidelines §11) ─────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS dispatch (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL UNIQUE,
          transporter TEXT,
          vehicle_no TEXT,
          lr_no TEXT,
          dispatched_qty_kg REAL,
          dispatched_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
      `);

      // ── Cancellation tracker (Guidelines §13) ─────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS cancellations (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          spec TEXT,
          order_value_paise INTEGER,
          token_min_paise INTEGER,
          token_max_paise INTEGER,
          confirmed_at TEXT,
          cancelled_at TEXT DEFAULT (datetime('now')),
          days_elapsed REAL,
          follow_ups_sent INTEGER,
          reason TEXT,
          cancelled_by TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        CREATE INDEX IF NOT EXISTS idx_cancellations_customer ON cancellations(customer_id);
      `);

      // ── Seasonal demand declarations (Guidelines §12) ─────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS seasonal_demand (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          peak_months TEXT,
          typical_qty_kg REAL,
          declared_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_seasonal_customer ON seasonal_demand(customer_id);
      `);

      // ── Client Profile Layer 2 fields (Impl Spec §5) ──────────────────────
      addColumnIfMissing(db, "customers", "preferred_grade", "preferred_grade TEXT");
      addColumnIfMissing(db, "customers", "preferred_width", "preferred_width TEXT");
      addColumnIfMissing(db, "customers", "preferred_colour", "preferred_colour TEXT");
      addColumnIfMissing(db, "customers", "preferred_lamination", "preferred_lamination TEXT");
      addColumnIfMissing(db, "customers", "peak_months", "peak_months TEXT");
      addColumnIfMissing(db, "customers", "typical_order_kg", "typical_order_kg REAL");
      addColumnIfMissing(db, "customers", "nature_of_business", "nature_of_business TEXT");
      addColumnIfMissing(db, "customers", "branch_addresses", "branch_addresses TEXT");
      addColumnIfMissing(db, "customers", "first_order_date", "first_order_date TEXT");
      addColumnIfMissing(db, "customers", "last_order_date", "last_order_date TEXT");
      addColumnIfMissing(db, "customers", "total_orders", "total_orders INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "customers", "total_kg", "total_kg REAL NOT NULL DEFAULT 0");
      addColumnIfMissing(db, "customers", "total_value_paise", "total_value_paise INTEGER NOT NULL DEFAULT 0");
    },
  },

  {
    id: 4,
    name: "phase4_outbox_sheet_imports",
    up: (db) => {
      // ── Outbound message queue with delivery tracking (audit P1-7) ────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          recipient_phone TEXT NOT NULL,
          customer_id TEXT,
          template_id TEXT,
          language TEXT,
          variables_json TEXT,
          rendered_text TEXT,
          channel TEXT NOT NULL DEFAULT 'session',  -- 'session' | 'template'
          status TEXT NOT NULL DEFAULT 'queued',     -- queued|sent|delivered|read|failed
          chakra_message_id TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          last_error TEXT,
          dedup_key TEXT,
          scheduled_at TEXT DEFAULT (datetime('now')),
          sent_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, scheduled_at);
        CREATE INDEX IF NOT EXISTS idx_outbox_msgid ON outbox(chakra_message_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_dedup ON outbox(dedup_key) WHERE dedup_key IS NOT NULL;
      `);

      // ── Daily sheet ingestion audit (Phase 4 — requirement #2) ────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS sheet_imports (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,        -- 'xlsx_upload' | 'google_sheet' | 'csv'
          filename TEXT,
          sheet_tab TEXT,
          content_hash TEXT,
          rows_total INTEGER NOT NULL DEFAULT 0,
          rows_valid INTEGER NOT NULL DEFAULT 0,
          rows_invalid INTEGER NOT NULL DEFAULT 0,
          rows_processed INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',  -- pending|validated|processed|failed
          errors_json TEXT,
          imported_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sheet_imports_created ON sheet_imports(created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sheet_imports_hash ON sheet_imports(content_hash) WHERE content_hash IS NOT NULL;
      `);
    },
  },

  {
    id: 5,
    name: "phase4_template_store",
    up: (db) => {
      // DB-backed, versioned template store (Phase 4 review P1).
      db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,                          -- T1..T31
          name TEXT NOT NULL,
          category TEXT,
          required_vars TEXT NOT NULL DEFAULT '[]',      -- JSON array (canonical contract)
          canonical_var_order TEXT NOT NULL DEFAULT '[]',-- JSON array (positional order)
          version INTEGER NOT NULL DEFAULT 1,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS template_variants (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          language TEXT NOT NULL,
          body TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          chakra_template_name TEXT,
          approval_status TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|approved|rejected
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(template_id, language),
          FOREIGN KEY (template_id) REFERENCES templates(id)
        );
        CREATE INDEX IF NOT EXISTS idx_tvariants_tpl ON template_variants(template_id);
        CREATE TABLE IF NOT EXISTS template_versions (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          language TEXT NOT NULL,
          body TEXT NOT NULL,
          version INTEGER NOT NULL,
          changed_by TEXT,
          changed_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tversions_tpl ON template_versions(template_id, language);
      `);

      // Outbox: record which required vars were missing on a blocked send.
      addColumnIfMissing(db, "outbox", "missing_vars", "missing_vars TEXT");
    },
  },

  {
    id: 6,
    name: "demand_intelligence",
    up: (db) => {
      // Per-customer demand profile (declared + derived + owner), one row each.
      // Typed essentials are indexed/queryable; the long tail lives in JSON
      // `attributes` so the model evolves without migrations. This consolidates
      // the previously scattered customers.peak_months / typical_order_kg etc.
      db.exec(`
        CREATE TABLE IF NOT EXISTS demand_profile (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL UNIQUE,
          -- declared (asked)
          peak_months TEXT,              -- CSV month numbers "10,11,12"
          low_months TEXT,
          festival_drivers TEXT,         -- free text, e.g. "Diwali, wedding season"
          planning_lead_days INTEGER,    -- how far ahead they plan
          primary_application TEXT,      -- end-use, e.g. "cement bags"
          industry_segment TEXT,         -- e.g. "agriculture", "FIBC"
          climate_sensitivity TEXT,      -- e.g. "monsoon-sensitive"
          -- derived (computed from orders)
          region_state TEXT,
          buying_pattern TEXT,           -- regular | bulk | mixed
          order_frequency_days REAL,
          repeat_cycle_days REAL,
          avg_order_kg REAL,
          peak_order_kg REAL,
          derived_peak_months TEXT,      -- from actual order timestamps
          preferred_grade TEXT,
          preferred_width TEXT,
          preferred_colour TEXT,
          preferred_lamination TEXT,
          preferred_grammage TEXT,
          total_orders INTEGER NOT NULL DEFAULT 0,
          total_kg REAL NOT NULL DEFAULT 0,
          -- evolving long tail + governance
          attributes TEXT NOT NULL DEFAULT '{}',
          declared_completeness REAL NOT NULL DEFAULT 0,
          seasonal_asked_at TEXT,        -- when T5 was last sent (so we don't nag)
          pending_ask TEXT,              -- which declared slot is awaiting an answer
          derived_at TEXT,
          declared_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_demand_region ON demand_profile(region_state);
        CREATE INDEX IF NOT EXISTS idx_demand_industry ON demand_profile(industry_segment);
      `);

      // Append-only raw declared-signal log (audit + reprocessing).
      db.exec(`
        CREATE TABLE IF NOT EXISTS demand_signals (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          kind TEXT NOT NULL,            -- peak_months | low_months | festival | application | planning_lead | other
          raw_text TEXT,
          language TEXT,
          extracted_json TEXT,
          source TEXT DEFAULT 'agent',   -- agent | owner
          confidence REAL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_demand_signals_customer ON demand_signals(customer_id, created_at DESC);
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare(`SELECT version FROM schema_migrations`).all() as Array<{ version: number }>).map(
      (r) => r.version
    )
  );

  for (const migration of MIGRATIONS.sort((a, b) => a.id - b.id)) {
    if (applied.has(migration.id)) continue;
    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare(`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`).run(
        migration.id,
        migration.name
      );
    });
    tx();
  }
}
