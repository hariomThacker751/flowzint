import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { runMigrations } from "./migrations";

/**
 * Cache the DB connection on globalThis so it survives Next.js Hot Module
 * Replacement (HMR) in development. Without this, every file-save creates a new
 * connection without closing the old one, eventually causing SQLITE_BUSY errors.
 */
declare global {
  // eslint-disable-next-line no-var
  var __sqliteDb: Database.Database | undefined;
}

export function getDatabase(): Database.Database {
  if (globalThis.__sqliteDb) return globalThis.__sqliteDb;

  const dbPath =
    process.env.DATABASE_URL
      ?.replace("sqlite+aiosqlite:///", "")
      .replace("sqlite:///", "") || "data/sales_agent.db";
  const fullPath = join(process.cwd(), dbPath);

  // Ensure data directory exists
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(fullPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Allow up to 5s for concurrent readers to finish before throwing SQLITE_BUSY
  db.pragma("busy_timeout = 5000");

  // Initialize legacy schema (back-compat), then run ordered migrations and seed.
  initializeSchema(db);
  runMigrations(db);
  seedDefaults(db);

  globalThis.__sqliteDb = db;
  return db;
}

/**
 * Seed configuration defaults and a bootstrap owner account.
 *
 * Policy values (token range, cancellation window, tax rates, company/bank
 * details) live in `app_config` so there is a single source of truth instead
 * of hardcoded literals scattered through prompts and NLG. The owner account
 * is created from OWNER_USERNAME / OWNER_PASSWORD env vars on first boot.
 */
function seedDefaults(db: Database.Database) {
  const upsert = db.prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO NOTHING`
  );
  const defaults: Record<string, string> = {
    "payment.token_min_pct": "10",
    "payment.token_max_pct": "25",
    "payment.cancellation_window_days": "3",
    "tax.igst_pct": "18",
    "tax.cgst_pct": "9",
    "tax.sgst_pct": "9",
    "tax.home_state_code": "24", // Gujarat — Anjani Interweave
    "invoice.hsn_pp_box": "54071000",
    "invoice.validity_days": "3",
    "company.gstin": "24ABJFA5190P1ZZ",
    "company.name": "ANJANI INTERWEAVE",
    "company.bank_block":
      "AXIS BANK LTD\nA/C NO. 921030041294340\nIFSC CODE: UTIB0004665\nBRANCH: SALABATPURA, SURAT",
    "company.upi_details": "", // accounts team confirms before go-live (Impl Spec §1.2)
    "company.internal_group_phone": process.env.INTERNAL_GROUP_PHONE || "",
  };
  for (const [k, v] of Object.entries(defaults)) upsert.run(k, v);

  // Seed the WhatsApp template store from the bundled native-language library.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedTemplatesFromFile } = require("./services/templates") as typeof import("./services/templates");
    seedTemplatesFromFile(db);
  } catch (e) {
    console.error("[db] template seed skipped:", e);
  }

  // Bootstrap owner account (idempotent). Password hashing is done lazily here
  // via a dynamic import to avoid a hard dependency cycle at module load.
  const ownerUser = process.env.OWNER_USERNAME;
  const ownerPass = process.env.OWNER_PASSWORD;
  if (ownerUser && ownerPass) {
    const exists = db.prepare(`SELECT 1 FROM users WHERE username = ?`).get(ownerUser);
    if (!exists) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { hashPassword } = require("./auth") as typeof import("./auth");
      db.prepare(
        `INSERT INTO users (id, username, password_hash, role, name) VALUES (?, ?, ?, 'owner', ?)`
      ).run(crypto.randomUUID(), ownerUser, hashPassword(ownerPass), "Owner");
    }
  }
}

function initializeSchema(db: Database.Database) {
  // Create customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      company TEXT,
      gst_number TEXT,
      email TEXT,
      city TEXT,
      state TEXT,
      language TEXT DEFAULT 'en',
      stage TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(stage);
  `);

  // Create chat_messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_customer ON chat_messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
  `);

  // Create enquiries table
  db.exec(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      size_inches INTEGER,
      grammage REAL,
      quality TEXT,
      color TEXT,
      lamination TEXT,
      quantity_kg REAL,
      delivery_city TEXT,
      seasonal_months TEXT,
      gst_details TEXT,
      delivery_terms TEXT,
      status TEXT DEFAULT 'enquiry',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
  `);

  // Migrate existing enquiries table: add new columns if they don't exist yet
  try { db.exec(`ALTER TABLE enquiries ADD COLUMN gst_details TEXT`); } catch (_e) {}
  try { db.exec(`ALTER TABLE enquiries ADD COLUMN delivery_terms TEXT`); } catch (_e) {}

  // Create quotes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      base_price REAL NOT NULL,
      size_premium REAL DEFAULT 0,
      color_premium REAL DEFAULT 0,
      lamination_premium REAL DEFAULT 0,
      grammage_adjustment REAL DEFAULT 0,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      validity_days INTEGER DEFAULT 7,
      owner_approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      approved_at TEXT,
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_enquiry ON quotes(enquiry_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_approved ON quotes(owner_approved);
  `);

  // Create price_config table for box pricing (13" base prices for all quality grades)
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_config (
      id TEXT PRIMARY KEY,
      base_price_3g REAL,  -- Legacy field (kept for backward compatibility)
      base_price_janta REAL NOT NULL DEFAULT 0,
      base_price_regular REAL NOT NULL DEFAULT 0,
      base_price_silver REAL NOT NULL DEFAULT 0,
      base_price_gold REAL NOT NULL DEFAULT 0,
      base_price_platinum REAL NOT NULL DEFAULT 0,
      effective_date TEXT DEFAULT (datetime('now')),
      created_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_price_config_effective ON price_config(effective_date DESC);
  `);

  // Create knowledge_base table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'internal_only',
      source TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_key ON knowledge_base(key);
    CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge_base(scope);
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_base(type);
  `);

  // Create production_capacity table
  db.exec(`
    CREATE TABLE IF NOT EXISTS production_capacity (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      size_inches INTEGER NOT NULL,
      grammage REAL NOT NULL,
      planned_kg REAL NOT NULL,
      booked_kg REAL DEFAULT 0,
      available_kg REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(date, size_inches, grammage)
    );
    CREATE INDEX IF NOT EXISTS idx_capacity_date ON production_capacity(date);
    CREATE INDEX IF NOT EXISTS idx_capacity_size_gram ON production_capacity(size_inches, grammage);
  `);

  // Create activity_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor TEXT,
      customer_id TEXT,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
  `);

  // Create pending_escalations table — tracks questions sent to owner awaiting reply
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_escalations (
      id TEXT PRIMARY KEY,
      customer_phone TEXT NOT NULL,
      customer_name TEXT,
      customer_id TEXT,
      question TEXT NOT NULL,
      holding_message TEXT,
      status TEXT DEFAULT 'pending',
      owner_reply TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_escalations_status ON pending_escalations(status);
    CREATE INDEX IF NOT EXISTS idx_escalations_created ON pending_escalations(created_at DESC);
  `);

  // Create corrugator_bookings table — monthly capacity booking pool
  db.exec(`
    CREATE TABLE IF NOT EXISTS corrugator_bookings (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      kg_booked REAL NOT NULL,
      kg_per_day REAL DEFAULT 150,
      delivery_estimate_days INTEGER,
      status TEXT DEFAULT 'booked',
      payment_confirmed_at TEXT,
      production_started_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_corrugator_bookings_month ON corrugator_bookings(month_key);
    CREATE INDEX IF NOT EXISTS idx_corrugator_bookings_enquiry ON corrugator_bookings(enquiry_id);
    CREATE INDEX IF NOT EXISTS idx_corrugator_bookings_status ON corrugator_bookings(status);
  `);

  // Create processed_webhooks table for deduplication
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_webhooks (
      message_id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Create conversation_summaries table for persistent conversation memory
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_summaries (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      last_message_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_summaries_customer ON conversation_summaries(customer_id)`);

  // Add specs_json and summary_generated_at columns to customers (persistent state)
  try { db.exec(`ALTER TABLE customers ADD COLUMN specs_json TEXT`); } catch (_e) {}
  try { db.exec(`ALTER TABLE customers ADD COLUMN summary_generated_at TEXT`); } catch (_e) {}

  // ─────────────────────────────────────────────────────────────
  // v3.0 tables — Guidelines v3 Sections 6, 8, 10, 11, 12, 13
  // ─────────────────────────────────────────────────────────────

  // Dispatch Schedule (Section 11) — 14-day rolling view, auto-WhatsApp 3 days pre-ETA
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_schedule (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      spec TEXT,
      quantity_kg REAL,
      eta_date TEXT NOT NULL,
      alert_sent INTEGER DEFAULT 0,
      alert_sent_at TEXT,
      transport_confirmed INTEGER DEFAULT 0,
      transport_confirmed_at TEXT,
      status TEXT DEFAULT 'scheduled',           -- scheduled | alert_sent | ready | dispatched | cancelled
      total_value REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_eta ON dispatch_schedule(eta_date);
    CREATE INDEX IF NOT EXISTS idx_dispatch_status ON dispatch_schedule(status);
    CREATE INDEX IF NOT EXISTS idx_dispatch_enquiry ON dispatch_schedule(enquiry_id);
  `);

  // Cancelled Orders (Section 13) — full audit trail, 90-day retention, client flag
  db.exec(`
    CREATE TABLE IF NOT EXISTS cancelled_orders (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      size_inches REAL,
      grammage REAL,
      quality TEXT,
      color TEXT,
      lamination TEXT,
      quantity_kg REAL,
      order_value REAL,
      token_min REAL,                            -- 10% of order value
      token_max REAL,                            -- 25% of order value
      confirmed_at TEXT,
      cancelled_at TEXT DEFAULT (datetime('now')),
      days_elapsed INTEGER,
      followups_sent INTEGER DEFAULT 0,
      reason TEXT,                               -- non_payment | followup_failure | client_withdrawal | production_issue
      cancelled_by TEXT,                         -- auto | owner name
      client_flagged INTEGER DEFAULT 1,          -- Section 13.3: flagged clients need upfront payment
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cancelled_phone ON cancelled_orders(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_cancelled_reason ON cancelled_orders(reason);
  `);

  // Seasonal Demand (Section 12) — aspirational, collected from client conversations, 4 dimensions
  db.exec(`
    CREATE TABLE IF NOT EXISTS seasonal_demand (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT,
      state TEXT,
      dimension TEXT NOT NULL,                   -- client | size | quality | region
      dimension_value TEXT,                      -- e.g. "36 inch", "Gold", "Gujarat"
      peak_months TEXT,                          -- comma-separated month numbers, e.g. "10,11,12"
      typical_quantity_kg REAL,
      lead_time_days INTEGER,
      source TEXT DEFAULT 'ravi',                -- ravi | owner
      declared INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_seasonal_dimension ON seasonal_demand(dimension);
    CREATE INDEX IF NOT EXISTS idx_seasonal_customer ON seasonal_demand(customer_id);
  `);

  // Trading Desk (Section 6) — proactive/reactive sourcing, 30-day rule, quality gate
  db.exec(`
    CREATE TABLE IF NOT EXISTS trading_desk (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      spec TEXT,
      quantity_kg REAL,
      trigger_type TEXT NOT NULL,                -- proactive | reactive
      thirty_day_rule_applies INTEGER DEFAULT 0, -- 1 for proactive (own prod covered first), 0 for reactive
      hierarchy_notified INTEGER DEFAULT 0,
      hierarchy_notified_at TEXT,
      hierarchy_approved_by TEXT,
      source_supplier TEXT,                      -- third-party manufacturer
      quality_gate_status TEXT DEFAULT 'pending', -- pending | lab_report | samples | approved | failed
      quality_gate_at TEXT,
      quality_gate_by TEXT,
      dispatch_confirmed INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'sourcing',            -- sourcing | quality_gate | ready | dispatched | failed
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trading_status ON trading_desk(status);
    CREATE INDEX IF NOT EXISTS idx_trading_trigger ON trading_desk(trigger_type);
  `);

  // Approval audit trail (Section 8) — unified stamp "[Action] by [Approver] at [HH:MM, Date]"
  db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      ref_type TEXT,                             -- escalation | token | trading | quality_gate | deal_desk | base_price
      ref_id TEXT,
      customer_name TEXT,
      spec TEXT,
      approver TEXT,                             -- Puneet | Dev | Manager
      action TEXT,                               -- Approved | Declined | Approved with Modification
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_ref ON approvals(ref_type, ref_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver);
  `);

  // Token follow-up log (Section 10.2) — 3-day sequence
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_followups (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      day_number INTEGER,                        -- 1 | 2 | 3
      message TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
    );
    CREATE INDEX IF NOT EXISTS idx_token_followups_enquiry ON token_followups(enquiry_id);
  `);

  // Corrugator bookings: live production tracking (Sections 11.1, 13) — additive columns
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN kg_produced REAL DEFAULT 0`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN eta_original TEXT`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN eta_revised TEXT`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN dispatch_alert_sent_at TEXT`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN followups_sent INTEGER DEFAULT 0`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN token_percentage REAL`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN token_amount REAL`); } catch (_e) {}
  try { db.exec(`ALTER TABLE corrugator_bookings ADD COLUMN token_received_at TEXT`); } catch (_e) {}

  // Corrugator Floor Config — digital twin of the owner's corrugator floor (45 corrugators).
  // Owner-controllable: how many corrugators are FREE right now for new orders.
  // When the owner takes an external order (outside the system), he tells Director
  // "X corrugators busy with offline order" and this updates. Single row (key='floor').
  // ALL capacity / ETA / dispatch / feasibility math derives from these numbers.
  db.exec(`
    CREATE TABLE IF NOT EXISTS corrugator_floor_config (
      key TEXT PRIMARY KEY DEFAULT 'floor',
      total_corrugators INTEGER DEFAULT 45,
      corrugators_available INTEGER DEFAULT 45,        -- FREE for new system orders right now
      corrugators_maintenance INTEGER DEFAULT 0,       -- out for repair / breakdown
      corrugators_external INTEGER DEFAULT 0,          -- busy with non-system (offline) orders
      updated_by TEXT DEFAULT 'system',
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  {
    const floorExists = db.prepare("SELECT COUNT(*) as count FROM corrugator_floor_config").get() as { count: number };
    if (floorExists.count === 0) {
      db.prepare(`
        INSERT INTO corrugator_floor_config (key, total_corrugators, corrugators_available, corrugators_maintenance, corrugators_external, updated_by, notes)
        VALUES ('floor', 45, 45, 0, 0, 'system', 'Initial floor — all 45 corrugators free')
      `).run();
    }
  }

  // Insert default price config if none exists
  const priceCount = db.prepare("SELECT COUNT(*) as count FROM price_config").get() as { count: number };
  if (priceCount.count === 0) {
    db.prepare(`
      INSERT INTO price_config (id, base_price_3g, created_by, notes)
      VALUES (?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      80,
      "system",
      "Initial base price"
    );
  }
}

export function closeDatabase() {
  if (globalThis.__sqliteDb) {
    globalThis.__sqliteDb.close();
    globalThis.__sqliteDb = undefined;
  }
}

export function checkDatabaseHealth(): {
  healthy: boolean;
  tables: string[];
  issues: string[];
  counts: Record<string, number>;
} {
  try {
    const db = getDatabase();
    const tables: string[] = [];
    const issues: string[] = [];
    const counts: Record<string, number> = {};

    // Get all tables
    const tableQuery = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    for (const { name } of tableQuery) {
      tables.push(name);
      try {
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
        counts[name] = countResult.count;
      } catch (error) {
        issues.push(`Failed to count rows in ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Check for required tables
    const requiredTables = [
      'customers',
      'chat_messages',
      'enquiries',
      'quotes',
      'price_config',
      'knowledge_base',
      'production_capacity',
      'activity_log',
      'corrugator_bookings'
    ];

    for (const table of requiredTables) {
      if (!tables.includes(table)) {
        issues.push(`Missing required table: ${table}`);
      }
    }

    // Check for base price
    if (counts.price_config === 0) {
      issues.push('No base price configured in price_config table');
    }

    return {
      healthy: issues.length === 0,
      tables,
      issues,
      counts
    };
  } catch (error) {
    return {
      healthy: false,
      tables: [],
      issues: [`Database health check failed: ${error instanceof Error ? error.message : String(error)}`],
      counts: {}
    };
  }
}

export function seedTestData(): {
  success: boolean;
  message: string;
  seeded: Record<string, number>;
} {
  try {
    const db = getDatabase();
    const seeded: Record<string, number> = {};

    // Seed knowledge base with sample facts
    const knowledgeEntries = [
      {
        key: 'meter_weight:36:3.0:unlam',
        value: '180 g/m',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'meter_weight:34:3.5:unlam',
        value: '195 g/m',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'quality:silver:strength',
        value: '1600 N',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'quality:gold:strength',
        value: '1800 N',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'company:name',
        value: 'Anjani Interweave',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'company:location',
        value: 'Surat, Gujarat',
        type: 'fact',
        scope: 'customer_visible'
      },
      {
        key: 'rule:minimum_order',
        value: 'Minimum order quantity is 500 kg',
        type: 'rule',
        scope: 'internal_only'
      }
    ];

    let knowledgeCount = 0;
    for (const entry of knowledgeEntries) {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO knowledge_base (id, key, value, type, scope, source)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          entry.key,
          entry.value,
          entry.type,
          entry.scope,
          'seed'
        );
        knowledgeCount++;
      } catch (error) {
        // Skip if already exists
      }
    }
    seeded.knowledge_base = knowledgeCount;

    // Seed production capacity for next 30 days
    const today = new Date();
    const sizes = [24, 26, 28, 30, 32, 34, 36];
    const grammages = [3.0, 3.5, 4.0, 4.5, 5.0];
    let capacityCount = 0;

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      for (const size of sizes) {
        for (const grammage of grammages) {
          // Calculate planned capacity (larger sizes have more capacity)
          const plannedKg = (size >= 32 ? 2000 : 1500) + Math.random() * 500;
          const bookedKg = Math.random() * plannedKg * 0.5; // 0-50% booked
          const availableKg = plannedKg - bookedKg;

          try {
            db.prepare(`
              INSERT OR REPLACE INTO production_capacity 
              (id, date, size_inches, grammage, planned_kg, booked_kg, available_kg)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              crypto.randomUUID(),
              dateStr,
              size,
              grammage,
              Math.round(plannedKg),
              Math.round(bookedKg),
              Math.round(availableKg)
            );
            capacityCount++;
          } catch (error) {
            // Skip if already exists
          }
        }
      }
    }
    seeded.production_capacity = capacityCount;

    return {
      success: true,
      message: 'Test data seeded successfully',
      seeded
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to seed test data: ${error instanceof Error ? error.message : String(error)}`,
      seeded: {}
    };
  }
}

