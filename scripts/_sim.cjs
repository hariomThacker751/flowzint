/* Conversation simulation harness — drives the REAL unified agent against an
 * isolated COPY of the production DB (so pricing/templates exist), autoSend=false
 * (no real WhatsApp sends), unique test phone numbers. Captures full transcripts.
 *
 * Prereq: npx tsc -p tsconfig.sim.json   (emits to .ttest_sim/)
 * Run:    node scripts/_sim.cjs
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const TTEST = path.join(ROOT, ".ttest_sim");

// 1) Load env (SARVAM key etc.) WHILE still in the project root.
const { loadEnv } = require(path.join(TTEST, "lib", "server", "envLoader.js"));
loadEnv();
process.env.OWNER_USERNAME = process.env.OWNER_USERNAME || "puneet";
process.env.OWNER_PASSWORD = process.env.OWNER_PASSWORD || "secret123";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "sim-secret-abcdef-1234567890-xyz";

if (!process.env.SARVAM_API_KEY) {
  console.error("SARVAM_API_KEY not found — cannot run live simulation.");
  process.exit(2);
}

// 2) Register @/ path alias → compiled output.
require(path.join(ROOT, "node_modules", "tsconfig-paths")).register({
  baseUrl: TTEST,
  paths: { "@/*": ["*"] },
});

// 3) Isolated temp cwd with a COPY of the real DB + seed files.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flowzint-sim-"));
fs.mkdirSync(path.join(tmp, "data", "seed"), { recursive: true });
for (const f of ["clients.json", "whatsapp_templates.json"]) {
  const src = path.join(ROOT, "data", "seed", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, "data", "seed", f));
}
for (const f of ["sales_agent.db", "sales_agent.db-wal", "sales_agent.db-shm"]) {
  const src = path.join(ROOT, "data", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, "data", f));
}
process.chdir(tmp);
process.env.DATABASE_URL = "sqlite:///data/sales_agent.db";

// 4) Load the real agent + db (lazy DB open happens on first call, in temp cwd).
const { processCustomerMessageUnified } = require(path.join(TTEST, "lib", "server", "unified-agent.js"));
const { getDatabase } = require(path.join(TTEST, "lib", "server", "database.js"));
const db = getDatabase();

// Ensure a price_config exists (the copied DB should already have one).
const pc = db.prepare("SELECT * FROM price_config ORDER BY effective_date DESC LIMIT 1").get();
console.log("price_config present:", !!pc, pc ? `(3g base ₹${pc.base_price_3g})` : "(NONE — quotes will fail)");

function wipe(phone) {
  const c = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone);
  if (c) {
    for (const t of ["chat_messages", "quotes", "enquiries", "corrugator_bookings", "pending_escalations"]) {
      try { db.prepare(`DELETE FROM ${t} WHERE customer_id = ?`).run(c.id); } catch {}
    }
    try { db.prepare("DELETE FROM customers WHERE id = ?").run(c.id); } catch {}
  }
}

// Optional pre-seed to put a customer at a specific stage with known specs.
function preset(phone, name, stage, specs) {
  const crypto = require("crypto");
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO customers (id, phone, name, language, stage, specs_json) VALUES (?,?,?,?,?,?)")
    .run(id, phone, name, "english", stage, specs ? JSON.stringify(specs) : null);
  if (specs) {
    const eid = crypto.randomUUID();
    db.prepare("INSERT INTO enquiries (id, customer_id, size_inches, grammage, quality, color, lamination, quantity_kg, status) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(eid, id, specs.sizeInches, specs.grammage, specs.quality, specs.color || "White", specs.lamination || "None", specs.quantityKg, "in_production");
  }
}

const FULL = { sizeInches: 28, grammage: 4, quality: "Janta", color: "White", lamination: "None", quantityKg: 1000 };

// ── Scenarios ──────────────────────────────────────────────────────────────
const scenarios = [
  { id: 1, title: "Gujlish drip-feed — must acknowledge + ask NEXT spec each turn (no parroting)",
    turns: ["kem cho", "mane 32 inch nu box joiye", "4.5 gram", "gold quality", "1500 kg", "regular lamination", "ha barobar"] },
  { id: 2, title: "Hindi (Devanagari), ALL specs in one message — extraction + correct quote",
    turns: ["मुझे ३२ इंच, ४ ग्राम, गोल्ड क्वालिटी, सफेद, २ टन, अनलैमिनेटेड चाहिए", "हाँ ठीक है"] },
  { id: 3, title: "Marathi (Devanagari) ALL specs — was hallucinating ₹12 lakh before",
    turns: ["मला ३० इंच, ४ ग्रॅमेज, गोल्ड क्वालिटी, २ टन, अनलॅमिनेटेड हवे आहे"] },
  { id: 4, title: "Natural LAMINATION order — must QUOTE now (not escalate)",
    turns: ["28 inch 4 gram silver white 1 ton natural lamination"] },
  { id: 5, title: "Off-topic (English) — must clarify PP woven only",
    turns: ["do you guys make plastic carry bags or only box?"] },
  { id: 6, title: "Off-topic (Hinglish) — bori/sack",
    turns: ["bhai aap log ready bori bhi banate ho kya?"] },
  { id: 7, title: "Sub-22 inch (English) — must escalate/hold in correct language",
    turns: ["20 inch 4 gram gold 1 ton unlaminated white"] },
  { id: 8, title: "English drip-feed + confirm — must advance to payment, no lag",
    turns: ["hello", "i want 26 inch", "3.5 gram", "platinum", "unlaminated", "2 ton", "yes please proceed"] },
  { id: 9, title: "Half-coloured premium (+₹5/kg) — check pricing",
    turns: ["33 inch 4 gram gold half coloured 1 ton unlaminated"] },
  { id: 10, title: "Full-coloured premium (+₹7/kg) — check pricing",
    turns: ["30 inch 3 gram silver full coloured 500 kg regular lamination"] },
  { id: 11, title: "Gujarati script full specs",
    turns: ["મારે ૩૪ ઇંચ, ૫ ગ્રામ, પ્લેટિનમ, સફેદ, ૩ ટન, અનલેમિનેટેડ જોઈએ"] },
  { id: 12, title: "Negotiation after quote — hold the price",
    turns: ["29 inch 4 gram gold 2 ton unlaminated", "yaar 5 rupaye kam karo"] },
  { id: 13, title: "Mid-flow QUALITY correction",
    turns: ["31 inch 4 gram silver 1 ton unlaminated", "no make it platinum", "ok done"] },
  { id: 14, title: "Quantity-first then specs (Hinglish)",
    turns: ["bhai mujhe 3 ton chahiye", "35 inch 4 gram janta unlaminated"] },
  { id: 15, title: "VALID GST (different state) at awaiting_gst",
    preset: { stage: "awaiting_gst", specs: { sizeInches: 30, grammage: 4, quality: "Gold", color: "White", lamination: "None", quantityKg: 2000 } },
    turns: ["here is my gst 29AAGCB7383J1Z4"] },
  { id: 16, title: "INVALID GST (wrong checksum) at awaiting_gst — must re-ask",
    preset: { stage: "awaiting_gst", specs: { sizeInches: 30, grammage: 4, quality: "Gold", color: "White", lamination: "None", quantityKg: 2000 } },
    turns: ["27AAPFU0939F1ZA", "29AAGCB7383J1Z4"] },
  { id: 17, title: "Tamil script greeting + English specs",
    turns: ["வணக்கம், எனக்கு துணி வேண்டும்", "27 inch 4 gram gold 1 ton unlaminated"] },
];

(async () => {
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  log(`# Bot Conversation Simulation — ${new Date().toISOString()}`);
  log(`Model: ${process.env.SARVAM_MODEL || "sarvam-105b"} | autoSend: false | DB: isolated copy\n`);

  for (const sc of scenarios) {
    const phone = "9990000" + String(sc.id).padStart(3, "0");
    wipe(phone);
    if (sc.preset) preset(phone, "Test", sc.preset.stage, sc.preset.specs);

    log(`\n## Scenario ${sc.id}: ${sc.title}`);
    if (sc.preset) log(`_(preset: stage=${sc.preset.stage}, specs known)_`);
    for (const t of sc.turns) {
      let res;
      const started = Date.now();
      try {
        res = await processCustomerMessageUnified(phone, "Test", t, false);
      } catch (e) {
        log(`Customer: ${t}`);
        log(`Bot: [ERROR] ${e && e.message ? e.message : e}`);
        continue;
      }
      const ms = Date.now() - started;
      log(`Customer: ${t}`);
      log(`Bot: ${res.response}`);
      const sp = res.specs || {};
      log(`   ↳ stage=${res.stage} | escalated=${res.escalated} | specs={s:${sp.sizeInches},g:${sp.grammage},q:${sp.quality},lam:${sp.lamination},qty:${sp.quantityKg}} | ${ms}ms`);
    }
    wipe(phone);
  }

  const reportPath = path.join(ROOT, "SIM_TRANSCRIPTS_V2.md");
  fs.writeFileSync(reportPath, out.join("\n"), "utf8");
  console.log(`\n\nTranscripts written to ${reportPath}`);
})().catch((e) => { console.error("SIM FAILED:", e); process.exit(1); });
