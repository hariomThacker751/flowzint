/* Integration test harness for Phase 0–2. Runs against a throwaway SQLite DB.
 * Compile first: ./node_modules/.bin/tsc -p tsconfig.test.json
 * Run:           node scripts/_phase_test.cjs
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

// TEST-ONLY: redirect better-sqlite3 → node:sqlite shim (macOS prebuilt binary
// can't load on this Linux sandbox). The application code is unchanged.
const Module = require("module");
const bsqShim = require("./_bsq_shim.cjs");
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "better-sqlite3") return bsqShim;
  return _origLoad.apply(this, arguments);
};

// Fresh temp workspace so database.ts (which uses process.cwd()) is isolated.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "anjani-test-"));
// Seed files are resolved relative to cwd in prod; mirror them into the temp cwd.
fs.mkdirSync(path.join(tmp, "data", "seed"), { recursive: true });
for (const f of ["clients.json", "whatsapp_templates.json"]) {
  const src = path.join(__dirname, "..", "data", "seed", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, "data", "seed", f));
}
process.chdir(tmp);
process.env.DATABASE_URL = "sqlite:///test.db";
process.env.OWNER_USERNAME = "puneet";
process.env.OWNER_PASSWORD = "secret123";
process.env.SESSION_SECRET = "test-session-secret-abcdef*1234567890";

const B = path.join(__dirname, "..", ".ttest", "lib", "server");
const money = require(path.join(B, "money.js"));
const auth = require(path.join(B, "auth.js"));
const { getDatabase } = require(path.join(B, "database.js"));
const pricing = require(path.join(B, "pricing-engine.js"));
const tax = require(path.join(B, "services", "tax.js"));
const policy = require(path.join(B, "services", "policy.js"));
const esc = require(path.join(B, "services", "escalation.js"));
const order = require(path.join(B, "services", "order.js"));
const invoice = require(path.join(B, "services", "invoice.js"));
const payment = require(path.join(B, "services", "payment.js"));
const dunning = require(path.join(B, "services", "dunning.js"));
const production = require(path.join(B, "services", "production.js"));
const clientImport = require(path.join(B, "services", "client-import.js"));
const templates = require(path.join(B, "services", "templates.js"));
const outbox = require(path.join(B, "services", "outbox.js"));
const xlsx = require(path.join(B, "services", "xlsx-reader.js"));
const ingest = require(path.join(B, "services", "sheet-ingest.js"));
const triggers = require(path.join(B, "services", "triggers.js"));
const demand = require(path.join(B, "services", "demand.js"));
const dx = require(path.join(B, "services", "demand-extraction.js"));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, extra != null ? "→ " + JSON.stringify(extra) : ""); }
}
function eq(name, a, b) { ok(name + ` (=${b})`, a === b, a); }

(async () => {
  const db = getDatabase();

  console.log("\n[money]");
  eq("toPaise(89.5)", money.toPaise(89.5), 8950);
  eq("formatINR 9408000", money.formatINR(9408000), "94,080.00");
  eq("roundToNearest10 of 960000+", money.roundToNearest10Rupees(money.pctOfPaise(9600000, 10)), 960000);
  eq("amountInWords 94080", money.amountInWords(9408000), "Rupees Ninety Four Thousand Eighty Only");
  eq("amountInWords lakh", money.amountInWords(43200000), "Rupees Four Lakh Thirty Two Thousand Only");

  console.log("\n[migrations] tables exist");
  const tbls = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const t of ["users","app_config","orders","invoices","payments","approvals","interaction_timeline","sequences","schema_migrations"]) {
    ok("table " + t, tbls.includes(t));
  }

  console.log("\n[auth] owner seeded + password + session + stamps");
  const u = auth.findUserByUsername("puneet");
  ok("owner user seeded", !!u && u.role === "owner");
  ok("verifyPassword good", auth.verifyPassword("secret123", u.password_hash));
  ok("verifyPassword bad rejected", !auth.verifyPassword("wrong", u.password_hash));
  const tok = auth.createSessionToken({ id: u.id, username: u.username, role: "owner", name: "Puneet" });
  const sess = auth.verifySessionToken(tok);
  ok("session round-trips", sess && sess.role === "owner");
  ok("tampered session rejected", auth.verifySessionToken(tok.slice(0, -2) + "xx") === null);
  ok("approvalStamp format", /^Token confirmed by Puneet at \d\d:\d\d, \d\d\/\d\d\/\d{4}$/.test(auth.approvalStamp("Token confirmed", "Puneet")));
  const rt = auth.signResourceToken("invoice", "abc");
  ok("resource token verifies", auth.verifyResourceToken("invoice", "abc", rt));
  ok("resource token wrong id rejected", !auth.verifyResourceToken("invoice", "xyz", rt));

  console.log("\n[tax] IGST vs CGST+SGST");
  const tIn = tax.computeTax(9600000, "24ABJFA5190P1ZZ"); // Gujarat → intra
  eq("Gujarat → CGST_SGST", tIn.taxType, "CGST_SGST");
  eq("CGST 9%", tIn.cgstPaise, 864000);
  eq("SGST 9%", tIn.sgstPaise, 864000);
  const tOut = tax.computeTax(9600000, "03AATFP2117Q1ZT"); // Punjab → inter
  eq("Punjab → IGST", tOut.taxType, "IGST");
  eq("IGST 18%", tOut.igstPaise, 1728000);
  const tNone = tax.computeTax(9600000, null);
  eq("unregistered → IGST", tNone.taxType, "IGST");

  console.log("\n[policy] token range from grand total");
  const range = policy.computeTokenRange(tOut.grandTotalPaise); // 96000+17280 = 113280 → 10%/25%
  ok("token min ~10%", range.minPaise === money.roundToNearest10Rupees(Math.round(tOut.grandTotalPaise * 0.10)));
  ok("token max ~25%", range.maxPaise === money.roundToNearest10Rupees(Math.round(tOut.grandTotalPaise * 0.25)));

  console.log("\n[pricing] size table + escalation flags + daily gate");
  db.prepare("INSERT INTO price_config (id, base_price_3g, base_price_silver, effective_date, created_by) VALUES (?,?,?,datetime('now'),'test')")
    .run("pc-today", 80, 80);
  const p36 = pricing.calculatePrice({ sizeInches: 36, grammage: 4.0, quality: "silver", color: "White", lamination: "None", quantityKg: 1000 });
  eq("36\" 4.0g silver unit price (80-1)", p36.unitPrice, 79);
  ok("36\" not escalated", p36.requiresEscalation === false, p36.escalationReasons);
  ok("base price is today", p36.basePriceIsToday === true);
  const p13 = pricing.calculatePrice({ sizeInches: 13, grammage: 3.5, quality: "silver", color: "White", lamination: "None", quantityKg: 100 });
  eq("13\" carries NO size premium (bugfix)", p13.sizePremium, 0);
  ok("13\" escalates (sub-22)", p13.requiresEscalation && p13.escalationReasons.includes("size_below_22"));
  const p16 = pricing.calculatePrice({ sizeInches: 16, grammage: 3.0, quality: "silver", color: "White", lamination: "None", quantityKg: 100 });
  eq("16\" size premium +10", p16.sizePremium, 10);
  const pNat = pricing.calculatePrice({ sizeInches: 36, grammage: 3.5, quality: "gold", color: "White", lamination: "Natural", quantityKg: 100 });
  eq("natural lamination +5", pNat.laminationPremium, 5);
  ok("natural lamination does NOT escalate (standard product)", !pNat.escalationReasons.includes("natural_lamination"));

  console.log("\n[escalation] rule engine");
  ok("sub-22 escalates", esc.evaluateEscalation({ sizeInches: 19 }, "").escalate);
  ok("natural FABRIC escalates via message intent", esc.evaluateEscalation({}, "do you make natural fabric?").triggers.includes("natural_fabric"));
  ok("natural LAMINATION spec alone does NOT escalate", !esc.evaluateEscalation({ lamination: "Natural" }, "").escalate);
  ok("tax query escalates", esc.evaluateEscalation({}, "what about gst?").triggers.includes("tax_query"));
  ok("standard order does NOT escalate", esc.evaluateEscalation({ sizeInches: 36, color: "White", lamination: "None", grammage: 3.5 }, "ok").escalate === false);

  console.log("\n[order → PI → payment] end-to-end with stamps");
  db.prepare("INSERT INTO customers (id, phone, name, language, gst_number, city, state) VALUES (?,?,?,?,?,?,?)")
    .run("cust-1", "9115154896", "Gujarat Agro", "english", "24ABJFA5190P1ZZ", "Surat", "Gujarat");
  const ord = order.createOrder({
    customerId: "cust-1", sizeInches: 36, grammage: 5.0, quality: "Gold", color: "White",
    lamination: "None", quantityKg: 1000, unitPrice: 78, totalAmount: 78000,
  }, "order_confirmed");
  ok("order_no allocated ORD-YYYY-NNNN", /^ORD-\d{4}-\d{4}$/.test(ord.order_no), ord.order_no);
  eq("open orders count = 1", order.getOpenOrdersCount("cust-1"), 1);

  const { invoice: inv1 } = await invoice.generateProformaInvoice(ord.id, { quoteRef: "Q-1" });
  ok("PI number format PI-YYYYMMDD-NNN", /^PI-\d{8}-\d{3}$/.test(inv1.pi_number), inv1.pi_number);
  eq("PI tax = CGST_SGST (Gujarat client)", inv1.tax_type, "CGST_SGST");
  eq("PI taxable = 78000.00 → paise", inv1.taxable_value_paise, 7800000);
  eq("PI grand total = taxable + 18%", inv1.grand_total_paise, 7800000 + 702000 + 702000);
  ok("PI token min/max present", inv1.token_min_paise > 0 && inv1.token_max_paise > inv1.token_min_paise);

  // Second order same day → PI sequence increments
  const ord2 = order.createOrder({ customerId: "cust-1", sizeInches: 34, grammage: 3.5, quality: "Silver", color: "White", lamination: "None", quantityKg: 500, unitPrice: 80, totalAmount: 40000 }, "order_confirmed");
  const { invoice: inv2 } = await invoice.generateProformaInvoice(ord2.id);
  const seq1 = Number(inv1.pi_number.split("-")[2]);
  const seq2 = Number(inv2.pi_number.split("-")[2]);
  eq("PI sequence increments", seq2, seq1 + 1);

  // Regenerate same order → versions, keeps number
  const { invoice: inv1b } = await invoice.generateProformaInvoice(ord.id);
  eq("regeneration keeps PI number", inv1b.pi_number, inv1.pi_number);
  eq("regeneration bumps version", inv1b.version, 2);

  // Confirm token with stamp → order to production
  const pay = payment.confirmTokenPayment({ orderId: ord.id, tokenAmountPaise: money.toPaise(15000), approver: "Puneet", approverRole: "owner" });
  ok("payment stamp recorded", /Token confirmed by Puneet/.test(pay.stamp));
  eq("order now in_production", pay.orderStatus, "in_production");
  const appr = db.prepare("SELECT COUNT(*) n FROM approvals WHERE entity_type='payment'").get().n;
  ok("approval audit row written", appr === 1);
  const tl = db.prepare("SELECT COUNT(*) n FROM interaction_timeline WHERE order_id=?").get(ord.id).n;
  ok("timeline entries written", tl >= 2, tl);

  // Illegal transition guard
  let threw = false;
  try { order.advanceOrder(ord.id, "quote_approved"); } catch { threw = true; }
  ok("illegal transition rejected", threw);

  // ── Phase 3 ──────────────────────────────────────────────────────────────
  console.log("\n[phase3 migrations] tables exist");
  for (const t of ["production_batches","daily_production","dispatch","cancellations","seasonal_demand"]) {
    ok("table " + t, db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t) != null);
  }

  console.log("\n[dunning] reminders + auto-cancel + flag");
  // New customer + confirmed order, backdated 1 day, follow_ups_sent=1 → expect Day-2 reminder
  db.prepare("INSERT INTO customers (id, phone, name, language) VALUES (?,?,?,?)").run("cust-2","9999999999","Late Payer","english");
  const ordR = order.createOrder({ customerId:"cust-2", sizeInches:36, grammage:3.5, quality:"Silver", color:"White", lamination:"None", quantityKg:600, unitPrice:80, totalAmount:48000 }, "order_confirmed");
  dunning.openTokenWindow(ordR.id);
  db.prepare("UPDATE orders SET confirmed_at = datetime('now','-1 day'), follow_ups_sent=1 WHERE id=?").run(ordR.id);
  const rem = dunning.computeDueReminders().filter(a => a.orderId === ordR.id);
  ok("day-2 reminder due", rem.length === 1 && rem[0].day === 2, rem);

  // Backdate deadline into the past → auto-cancel
  db.prepare("UPDATE orders SET token_deadline = datetime('now','-1 hour') WHERE id=?").run(ordR.id);
  const cancels = dunning.computeDueCancellations().filter(a => a.orderId === ordR.id);
  ok("cancellation due", cancels.length === 1);
  dunning.executeCancellation(ordR.id, "non_payment", "Auto (system)");
  eq("order cancelled", order.getOrder(ordR.id).status, "cancelled");
  ok("cancellation row logged", db.prepare("SELECT 1 FROM cancellations WHERE order_id=?").get(ordR.id) != null);
  ok("client credit-flagged", db.prepare("SELECT credit_flag FROM customers WHERE id='cust-2'").get().credit_flag === 1);
  dunning.clearCreditFlag("cust-2","Puneet");
  ok("credit flag reversible by hierarchy", db.prepare("SELECT credit_flag FROM customers WHERE id='cust-2'").get().credit_flag === 0);

  console.log("\n[production] batch already created on token confirm → ETA + completion + dispatch");
  const batch = db.prepare("SELECT * FROM production_batches WHERE order_id=?").get(ord.id);
  ok("batch auto-created on token confirm", !!batch && /^B-\d{3}$/.test(batch.batch_no), batch && batch.batch_no);
  ok("target kg/day > 0", batch.target_kg_day > 0, batch.target_kg_day);
  const r1 = production.recordDailyKg(batch.id, "2026-06-25", 600, "ProdMgr");
  ok("partial: not complete", r1.completed === false && r1.batch.pct_complete === 60, r1.batch.pct_complete);
  const r2 = production.recordDailyKg(batch.id, "2026-06-26", 600, "ProdMgr"); // caps at 1000
  ok("full: complete at 100%", r2.completed === true && r2.batch.pct_complete === 100, r2.batch.pct_complete);
  production.markBatchComplete(batch.id, "ProdMgr");
  eq("order → ready_dispatch", order.getOrder(ord.id).status, "ready_dispatch");
  const disp = production.recordDispatch(ord.id, { vehicleNo: "GJ-05-AB-1234", actor: "ProdMgr" });
  eq("order → dispatched", disp.status, "dispatched");
  ok("dispatch row written", db.prepare("SELECT 1 FROM dispatch WHERE order_id=?").get(ord.id) != null);

  console.log("\n[client import] 12-client GST portal import");
  const imp = clientImport.importClientsFromSeed(path.join(__dirname, "..", "data", "seed", "clients.json"));
  ok("imported 12 clients", imp.total === 12 && (imp.imported + imp.updated) === 12, imp);
  const poly = db.prepare("SELECT * FROM customers WHERE business_name LIKE 'POLY SQUARE%'").get();
  ok("client mapped with GST + state code", poly && poly.gst_number && poly.state_code === "03", poly && poly.state_code);
  ok("address parsed (state/pincode)", poly && poly.pincode === "141010", poly && poly.pincode);
  const imp2 = clientImport.importClientsFromSeed(path.join(__dirname, "..", "data", "seed", "clients.json"));
  ok("re-import is idempotent (updates, no dupes)", imp2.imported === 0 && imp2.updated === 12, imp2);

  // ── Phase 4 ──────────────────────────────────────────────────────────────
  console.log("\n[templates] native render, NO English fallback, language resolution");
  ok("registry loaded 31 templates", templates.listTemplateIds().length === 31, templates.listTemplateIds().length);
  ok("8 languages available", templates.availableLanguages().length === 8, templates.availableLanguages());
  eq("gujlish → Gujarati", templates.resolveTemplateLanguage("gujlish"), "Gujarati");
  eq("hinglish → Hindi", templates.resolveTemplateLanguage("hinglish"), "Hindi");
  eq("unknown → Hindi default (NOT English)", templates.resolveTemplateLanguage("klingon"), "Hindi");
  eq("null → Hindi default", templates.resolveTemplateLanguage(null), "Hindi");
  const guj = templates.renderTemplate("T11", "gujlish", { CLIENT_NAME:"Ramesh", ORDER_ID:"ORD-1", TOKEN_MIN:"9,600", TOKEN_MAX:"24,000", PAYMENT_DETAILS:"AXIS BANK" });
  eq("T11 rendered in Gujarati", guj.language, "Gujarati");
  ok("T11 substitutes vars", guj.text.includes("Ramesh") && guj.text.includes("9,600") && !guj.text.includes("{{"), guj.text.slice(0,60));
  ok("T11 Gujarati has no leftover missing vars", guj.missingVars.length === 0, guj.missingVars);
  const tam = templates.renderTemplate("T1", "tamil", { CLIENT_NAME:"Suresh" });
  const eng = templates.renderTemplate("T1", "english", { CLIENT_NAME:"Suresh" });
  eq("Tamil resolves to Tamil", tam.language, "Tamil");
  ok("Tamil body is NOT the English body (real native text)", tam.text !== eng.text && tam.text.length > 20);
  ok("Tamil contains native romanization (Vanakkam)", /vanakkam/i.test(tam.text), tam.text.slice(0,40));
  const pos = templates.positionalParams("T11", "gujarati", { CLIENT_NAME:"R", ORDER_ID:"O", TOKEN_MIN:"1", TOKEN_MAX:"2", PAYMENT_DETAILS:"P" });
  ok("positional params ordered for ChakraHQ API", pos.templateVariables.length === 5 && pos.templateVariables[0] === "R", pos.templateVariables);

  console.log("\n[outbox] enqueue native + dedup + delivery status");
  const oid = outbox.enqueue({ phone:"9115154896", customerId:"cust-1", templateId:"T18", customerLanguage:"gujlish", vars:{ CLIENT_NAME:"R", ORDER_ID:"ORD-X", SPEC:"36\" 5g", QTY:"1000kg", DISPATCH_DATE:"27/06/2026" }, dedupKey:"ORD-X:T18" });
  ok("enqueue returns id", !!oid);
  const orow = db.prepare("SELECT * FROM outbox WHERE id=?").get(oid);
  eq("queued in Gujarati", orow.language, "Gujarati");
  ok("rendered native text stored, vars substituted", orow.rendered_text.includes("ORD-X") && !orow.rendered_text.includes("{{"));
  const dup = outbox.enqueue({ phone:"9115154896", templateId:"T18", customerLanguage:"gujlish", vars:{}, dedupKey:"ORD-X:T18" });
  ok("dedup_key prevents duplicate enqueue", dup === null);
  db.prepare("UPDATE outbox SET chakra_message_id='wamid.123' WHERE id=?").run(oid);
  ok("delivery status webhook updates outbox", outbox.recordDeliveryStatus("wamid.123","read") === true);
  eq("status now read", db.prepare("SELECT status FROM outbox WHERE id=?").get(oid).status, "read");

  console.log("\n[xlsx reader] dependency-free parse");
  const fs2 = require("fs");
  const buf = fs2.readFileSync(path.join(__dirname, "fixtures", "sample.xlsx"));
  const parsed = xlsx.readXlsxSheet(buf, "Production_Daily");
  eq("sheet tab name", parsed.name, "Production_Daily");
  ok("header row parsed", parsed.rows[0][0] === "Date" && parsed.rows[0][3] === "Actual_KG_Today", parsed.rows[0]);
  ok("data cells parsed (shared strings + numbers)", parsed.rows[1][1] === "B-001" && String(parsed.rows[1][3]) === "275", parsed.rows[1]);
  ok("unicode cell preserved", parsed.rows[2][4].includes("✓"), parsed.rows[2][4]);

  console.log("\n[sheet ingest] pipeline validate → map → process (pluggable source)");
  // Fresh order + batch for ingest (existing ord is already dispatched)
  db.prepare("INSERT INTO customers (id, phone, name, language) VALUES (?,?,?,?)").run("cust-3","8888888888","Ingest Co","gujarati");
  const ordI = order.createOrder({ customerId:"cust-3", sizeInches:36, grammage:3.5, quality:"Silver", color:"White", lamination:"None", quantityKg:1000, unitPrice:80, totalAmount:80000 }, "in_production");
  const batchI = production.createBatchForOrder(ordI.id);
  // In-memory SheetSource (proves the port abstraction; xlsx is one impl)
  const stubSource = {
    kind: "csv", name: "stub.csv",
    read: async () => ({ name:"Production_Daily", rows: [
      ["Date","Batch_ID","Order_ID","Actual_KG_Today"],
      ["25/06/2026", batchI.batch_no, ordI.order_no, "300"],
      ["26/06/2026", batchI.batch_no, "", "9999"],          // invalid: out of range
      ["27/06/2026", "B-999", "", "100"],                    // invalid: unknown batch
    ]}),
    contentHash: () => "stub-hash-" + Date.now(),
  };
  const res = await ingest.ingestProductionSheet(stubSource, "ProdMgr");
  eq("rows total", res.rowsTotal, 3);
  eq("rows valid/processed", res.rowsProcessed, 1);
  eq("rows invalid (range + unknown batch)", res.rowsInvalid, 2);
  ok("daily_production row written", db.prepare("SELECT actual_kg FROM daily_production WHERE batch_id=? AND prod_date='2026-06-25'").get(batchI.id).actual_kg === 300);
  ok("sheet_imports audit row written", db.prepare("SELECT 1 FROM sheet_imports WHERE id=?").get(res.importId) != null);
  ok("validation errors captured with row numbers", res.errors.length === 2 && res.errors[0].row === 3, res.errors);
  // Idempotency by content hash
  const fixedSource = Object.assign({}, stubSource, { contentHash: () => "fixed-hash-1" });
  await ingest.ingestProductionSheet(fixedSource, "ProdMgr");
  const again = await ingest.ingestProductionSheet(fixedSource, "ProdMgr");
  ok("re-ingest same content is idempotent", again.alreadyProcessed === true);

  // ── Phase 4 review (P0 fixes + DB store + contract + window + triggers) ────
  console.log("\n[P0 D1] canonical positional order (cross-language safe)");
  eq("templates seeded into DB", db.prepare("SELECT COUNT(*) n FROM templates").get().n, 31);
  eq("variants seeded into DB", db.prepare("SELECT COUNT(*) n FROM template_variants").get().n, 248);
  // T3 body order differs by language; positional params MUST follow canonical (English) order.
  const p3 = templates.positionalParams("T3", "gujlish", { CLIENT_NAME:"a", LAST_ORDER_SPEC:"SPEC", LAST_ORDER_DATE:"DATE" });
  ok("T3 positional uses canonical order (SPEC before DATE)", p3.templateVariables[1] === "SPEC" && p3.templateVariables[2] === "DATE", p3.templateVariables);
  ok("variable SETS consistent across languages (no set-level issues)", templates.validateVariableSets().length === 0, templates.validateVariableSets().slice(0,3));

  console.log("\n[P0 D2] escalation holds are native (no English fallback)");
  const tHold = templates.renderTemplate("T25", "tamil", { CLIENT_NAME:"Suresh" });
  eq("T25 resolves to Tamil", tHold.language, "Tamil");
  ok("T25 Tamil hold is native, not English/blank", tHold.text.length > 20 && tHold.text.includes("Suresh"), tHold.text.slice(0,40));

  console.log("\n[contract] required-var enforcement blocks blank sends");
  const blockedId = outbox.enqueue({ phone:"9115154896", customerId:"cust-1", templateId:"T11", customerLanguage:"hindi", vars:{ CLIENT_NAME:"R", ORDER_ID:"O" } }); // missing TOKEN_MIN/MAX/PAYMENT_DETAILS
  const brow = db.prepare("SELECT status, missing_vars FROM outbox WHERE id=?").get(blockedId);
  eq("missing required vars → blocked", brow.status, "blocked");
  ok("missing vars recorded", JSON.parse(brow.missing_vars).includes("TOKEN_MIN"), brow.missing_vars);

  console.log("\n[window] 24h session-window awareness");
  db.prepare("INSERT INTO customers (id, phone, name, language) VALUES (?,?,?,?)").run("cust-w","7777777777","Window Co","hindi");
  ok("no inbound → window closed", outbox.isSessionWindowOpen("cust-w") === false);
  db.prepare("INSERT INTO chat_messages (id, customer_id, channel, role, content) VALUES (?, ?, 'customer_whatsapp','user','hi')").run(require("crypto").randomUUID(), "cust-w");
  ok("recent inbound → window open", outbox.isSessionWindowOpen("cust-w") === true);
  // sendTemplated to a customer with NO inbound and no approved template → deferred (no send attempted)
  const def = await outbox.sendTemplated({ phone:"6666666666", customerId:"cust-3", templateId:"T18", customerLanguage:"gujarati", vars:{ CLIENT_NAME:"x", ORDER_ID:"O", SPEC:"s", QTY:"1kg", DISPATCH_DATE:"d" }, dedupKey:"defer-test" });
  ok("outside-window + no approved template → deferred, not failed", def.deferred === true && def.ok === false, def);

  console.log("\n[store] versioned edit + approval + ChakraHQ mapping");
  templates.updateVariantBody("T1", "Hindi", "Naya Hindi body {{CLIENT_NAME}} v2", "Puneet");
  eq("variant version bumped", db.prepare("SELECT version FROM template_variants WHERE template_id='T1' AND language='Hindi'").get().version, 2);
  ok("version history written", db.prepare("SELECT 1 FROM template_versions WHERE template_id='T1' AND language='Hindi'").get() != null);
  ok("edit visible after cache invalidation", templates.renderTemplate("T1","hindi",{CLIENT_NAME:"R"}).text.includes("Naya Hindi body"));
  ok("no chakra name until approved", templates.getChakraTemplateName("T1","Hindi") === null);
  templates.setVariantApproval("T1","Hindi","approved","anjani_t1_hi");
  eq("chakra name returned once approved", templates.getChakraTemplateName("T1","Hindi"), "anjani_t1_hi");

  console.log("\n[triggers] central event→template map");
  eq("order_confirmation → T10", triggers.templateForEvent("order_confirmation"), "T10");
  eq("production_started → T16", triggers.templateForEvent("production_started"), "T16");
  eq("post_delivery → T31", triggers.templateForEvent("post_delivery"), "T31");

  // ── Demand intelligence (T5 → demand profile) ─────────────────────────────
  console.log("\n[demand] month/festival normalization (deterministic core)");
  ok("range 'October to January' → 1,10,11,12", JSON.stringify(dx.normalizeMonths("October to January is our peak")) === JSON.stringify([1,10,11,12]), dx.normalizeMonths("October to January"));
  ok("Diwali → Oct,Nov", JSON.stringify(dx.normalizeMonths("mostly around Diwali")) === JSON.stringify([10,11]), dx.normalizeMonths("Diwali"));
  ok("monsoon → 6,7,8,9", JSON.stringify(dx.normalizeMonths("monsoon months we need most")) === JSON.stringify([6,7,8,9]));
  ok("year round → 1..12", dx.normalizeMonths("we order all year round").length === 12);
  ok("'we may order' does NOT false-match May", dx.normalizeMonths("we may order more later").length === 0, dx.normalizeMonths("we may order more later"));
  ok("explicit list Oct, Nov, Dec", JSON.stringify(dx.normalizeMonths("Oct, Nov and Dec")) === JSON.stringify([10,11,12]));
  const det = dx.extractDeterministic("we buy cement bags, plan 15 days before, peak October to January");
  ok("planning lead 15 days parsed", det.planningLeadDays === 15, det.planningLeadDays);
  eq("industry inferred = construction", det.industry, "construction");

  console.log("\n[demand] profile: declared capture + derivation + aggregates");
  db.prepare("INSERT INTO customers (id, phone, name, language, state) VALUES (?,?,?,?,?)").run("cust-d","5555500000","Demand Co","english","Gujarat");
  demand.recordSignal("cust-d","peak_months","October to January","english", dx.extractDeterministic("October to January"));
  eq("declared peak_months stored", db.prepare("SELECT peak_months FROM demand_profile WHERE customer_id='cust-d'").get().peak_months, "1,10,11,12");
  eq("customers mirror updated", db.prepare("SELECT peak_months FROM customers WHERE id='cust-d'").get().peak_months, "1,10,11,12");
  ok("declared signal logged", db.prepare("SELECT 1 FROM demand_signals WHERE customer_id='cust-d'").get() != null);
  // 3 orders → derive specs/qty/region
  for (const [q,kg] of [["Silver",800],["Silver",1200],["Gold",600]]) {
    order.createOrder({ customerId:"cust-d", sizeInches:36, grammage:3.5, quality:q, color:"White", lamination:"None", quantityKg:kg, unitPrice:80, totalAmount:80*kg }, "order_confirmed");
  }
  const prof = demand.deriveProfile("cust-d");
  eq("derived total_orders", prof.total_orders, 3);
  eq("derived avg_order_kg", prof.avg_order_kg, Math.round((800+1200+600)/3));
  eq("derived preferred_grade (mode)", prof.preferred_grade, "Silver");
  eq("derived region_state", prof.region_state, "Gujarat");
  ok("derived peak months present", (prof.derived_peak_months||"").length > 0);
  ok("buying pattern set", ["regular","bulk","mixed"].includes(prof.buying_pattern), prof.buying_pattern);
  const reb = demand.rebuildSeasonalAggregates();
  ok("seasonal aggregates rebuilt", reb.rows > 0, reb);
  ok("client dimension has Demand Co", demand.getSeasonalDimension("client").some(r => r.dimension_value === "Demand Co"));
  ok("size dimension populated", demand.getSeasonalDimension("size").length > 0);
  ok("quality dimension populated", demand.getSeasonalDimension("quality").length > 0);
  ok("region dimension populated", demand.getSeasonalDimension("region").some(r => r.dimension_value === "Gujarat"));
  ok("agent demand summary non-empty", /peak demand|industry|typical/.test(demand.getDemandSummaryForAgent("cust-d")), demand.getDemandSummaryForAgent("cust-d"));

  console.log(`\n========== ${pass} passed, ${fail} failed ==========`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
