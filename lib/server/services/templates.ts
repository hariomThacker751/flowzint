import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { getDatabase } from "../database";

/**
 * WhatsApp template service — DB-backed, versioned (Phase 4 review P1).
 *
 * The 248 native variants are the source of truth, held in the `templates` /
 * `template_variants` tables (seeded once from `data/seed/whatsapp_templates.json`,
 * then editable + versioned in the DB). Design guarantees:
 *  - NATIVE text only; regional customers never get English. Missing-variant
 *    fallback is Hindi (the spec default), never English.
 *  - A CANONICAL variable order per template (not per-language) drives ChakraHQ
 *    positional params — fixes the cross-language order divergence (e.g. T3).
 *  - A required-variable contract per template; renders report unmet required
 *    vars so the send layer can block instead of sending blanks.
 *  - Extensible: add a language = add variant rows (+ register a ChakraHQ name).
 */

export type TemplateMeta = {
  id: string;
  name: string;
  category: string;
  requiredVars: string[];
  canonicalOrder: string[];
  version: number;
  active: boolean;
};

const LANG_MAP: Record<string, string> = {
  english: "English", en: "English",
  hindi: "Hindi", hinglish: "Hindi", hi: "Hindi",
  gujarati: "Gujarati", gujlish: "Gujarati", gu: "Gujarati",
  tamil: "Tamil", ta: "Tamil",
  telugu: "Telugu", te: "Telugu",
  kannada: "Kannada", kn: "Kannada",
  malayalam: "Malayalam", ml: "Malayalam",
  marathi: "Marathi", "marathi-roman": "Marathi", mr: "Marathi",
};

/** Spec §15: default to Hindi when preference is unclear. NEVER English. */
export const DEFAULT_TEMPLATE_LANGUAGE = "Hindi";

export function resolveTemplateLanguage(customerLanguage: string | null | undefined): string {
  if (!customerLanguage) return DEFAULT_TEMPLATE_LANGUAGE;
  return LANG_MAP[customerLanguage.toLowerCase().trim()] || DEFAULT_TEMPLATE_LANGUAGE;
}

function categoryForId(id: string): string {
  const n = Number(id.replace(/\D/g, ""));
  if (n <= 3) return "outbound_prospecting";
  if (n <= 7) return "enquiry_qualification";
  if (n <= 10) return "quoting_order";
  if (n <= 15) return "payment_followup";
  if (n <= 20) return "production_dispatch";
  if (n <= 23) return "trading_desk";
  if (n <= 28) return "escalation_special";
  return "owner_saved";
}

// ── Seeding (idempotent) ─────────────────────────────────────────────────────

type SeedEntry = { id: string; name: string; language: string; variables: string[]; body: string };

export function seedTemplatesFromFile(db: Database.Database): void {
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM templates`).get() as { n: number }).n;
  if (count > 0) return;
  const file = path.join(process.cwd(), "data", "seed", "whatsapp_templates.json");
  if (!existsSync(file)) return;
  const entries = JSON.parse(readFileSync(file, "utf8")) as SeedEntry[];

  // Canonical order + required vars come from the English variant (authoritative).
  const english = new Map<string, SeedEntry>();
  for (const e of entries) if (e.language === "English") english.set(e.id, e);

  const insTpl = db.prepare(
    `INSERT OR IGNORE INTO templates (id, name, category, required_vars, canonical_var_order) VALUES (?, ?, ?, ?, ?)`
  );
  const insVar = db.prepare(
    `INSERT OR IGNORE INTO template_variants (id, template_id, language, body, approval_status) VALUES (?, ?, ?, ?, 'draft')`
  );
  const tx = db.transaction(() => {
    for (const [id, en] of english) {
      const order = JSON.stringify(en.variables);
      insTpl.run(id, en.name, categoryForId(id), order, order);
    }
    for (const e of entries) {
      insVar.run(crypto.randomUUID(), e.id, e.language, e.body);
    }
  });
  tx();
}

// ── Cache (rebuilt on edit) ──────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __tplMeta: Map<string, TemplateMeta> | undefined;
  // eslint-disable-next-line no-var
  var __tplVariants: Map<string, string> | undefined; // id::lang -> body
}

function vkey(id: string, language: string): string {
  return `${id.toUpperCase()}::${language}`;
}

export function invalidateTemplateCache(): void {
  globalThis.__tplMeta = undefined;
  globalThis.__tplVariants = undefined;
}

function meta(): Map<string, TemplateMeta> {
  if (globalThis.__tplMeta) return globalThis.__tplMeta;
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM templates`).all() as any[];
  const m = new Map<string, TemplateMeta>();
  for (const r of rows) {
    m.set(r.id.toUpperCase(), {
      id: r.id,
      name: r.name,
      category: r.category,
      requiredVars: JSON.parse(r.required_vars || "[]"),
      canonicalOrder: JSON.parse(r.canonical_var_order || "[]"),
      version: r.version,
      active: !!r.active,
    });
  }
  globalThis.__tplMeta = m;
  return m;
}

function variants(): Map<string, string> {
  if (globalThis.__tplVariants) return globalThis.__tplVariants;
  const db = getDatabase();
  const rows = db.prepare(`SELECT template_id, language, body FROM template_variants`).all() as any[];
  const m = new Map<string, string>();
  for (const r of rows) m.set(vkey(r.template_id, r.language), r.body);
  globalThis.__tplVariants = m;
  return m;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getTemplateMeta(id: string): TemplateMeta | null {
  return meta().get(id.toUpperCase()) ?? null;
}

/** Body for (id, language), falling back Hindi → any (never English-first). */
export function getTemplateBody(id: string, language: string): string | null {
  const v = variants();
  return (
    v.get(vkey(id, language)) ??
    v.get(vkey(id, DEFAULT_TEMPLATE_LANGUAGE)) ??
    [...v.entries()].find(([k]) => k.startsWith(`${id.toUpperCase()}::`))?.[1] ??
    null
  );
}

export type RenderedTemplate = {
  templateId: string;
  language: string;
  text: string;
  missingVars: string[];          // any {{VAR}} left unfilled
  missingRequiredVars: string[];  // required vars not supplied (→ block send)
};

export function renderTemplate(
  id: string,
  customerLanguage: string | null | undefined,
  vars: Record<string, string | number> = {}
): RenderedTemplate {
  const language = resolveTemplateLanguage(customerLanguage);
  const body = getTemplateBody(id, language);
  const m = getTemplateMeta(id);
  if (body === null) {
    return { templateId: id, language, text: "", missingVars: [], missingRequiredVars: m?.requiredVars ?? [] };
  }
  const missingVars: string[] = [];
  const text = body.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_x, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null || val === "") { missingVars.push(key); return ""; }
    return String(val);
  });
  const required = m?.requiredVars ?? [];
  const missingRequiredVars = required.filter((k) => missingVars.includes(k));
  // The fallback body may belong to Hindi; report the language actually used.
  const usedLang = variants().has(vkey(id, language)) ? language : DEFAULT_TEMPLATE_LANGUAGE;
  return { templateId: id, language: usedLang, text: text.replace(/[ \t]+\n/g, "\n").trim(), missingVars, missingRequiredVars };
}

/**
 * Ordered positional parapieces for the ChakraHQ template API ({{1}},{{2}}…),
 * using the CANONICAL per-template order (identical across languages) — fixes D1.
 */
export function positionalParams(
  id: string,
  customerLanguage: string | null | undefined,
  vars: Record<string, string | number> = {}
): { language: string; templateVariables: string[] } {
  const language = resolveTemplateLanguage(customerLanguage);
  const order = getTemplateMeta(id)?.canonicalOrder ?? [];
  return { language, templateVariables: order.map((k) => String(vars[k] ?? "")) };
}

/** ChakraHQ-registered template name for (id, language), if approved + mapped. */
export function getChakraTemplateName(id: string, language: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT chakra_template_name, approval_status FROM template_variants WHERE template_id = ? AND language = ?`)
    .get(id.toUpperCase(), language) as { chakra_template_name: string | null; approval_status: string } | undefined;
  if (row?.chakra_template_name && row.approval_status === "approved") return row.chakra_template_name;
  // Legacy/manual override via app_config.
  const cfg = db.prepare(`SELECT value FROM app_config WHERE key = ?`).get(`chakra.template.${id.toUpperCase()}.${language}`) as { value: string } | undefined;
  return cfg?.value || null;
}

export function listTemplateIds(): string[] {
  return [...meta().keys()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export function availableLanguages(): string[] {
  const langs = new Set<string>();
  for (const k of variants().keys()) langs.add(k.split("::")[1]);
  return [...langs];
}

// ── Admin (versioned edits) ──────────────────────────────────────────────────

export function updateVariantBody(id: string, language: string, body: string, changedBy: string): void {
  const db = getDatabase();
  const cur = db.prepare(`SELECT version FROM template_variants WHERE template_id = ? AND language = ?`).get(id.toUpperCase(), language) as { version: number } | undefined;
  const tx = db.transaction(() => {
    if (cur) {
      db.prepare(
        `INSERT INTO template_versions (id, template_id, language, body, version, changed_by) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), id.toUpperCase(), language, body, cur.version, changedBy);
      db.prepare(
        `UPDATE template_variants SET body = ?, version = version + 1, approval_status = 'draft', updated_at = datetime('now') WHERE template_id = ? AND language = ?`
      ).run(body, id.toUpperCase(), language);
    } else {
      db.prepare(
        `INSERT INTO template_variants (id, template_id, language, body) VALUES (?, ?, ?, ?)`
      ).run(crypto.randomUUID(), id.toUpperCase(), language, body);
    }
  });
  tx();
  invalidateTemplateCache();
}

export function setVariantApproval(id: string, language: string, status: string, chakraName?: string): void {
  getDatabase()
    .prepare(`UPDATE template_variants SET approval_status = ?, chakra_template_name = COALESCE(?, chakra_template_name), updated_at = datetime('now') WHERE template_id = ? AND language = ?`)
    .run(status, chakraName ?? null, id.toUpperCase(), language);
  invalidateTemplateCache();
}

/** Validation: every variant of a template should declare the same variable SET. */
export function validateVariableSets(): Array<{ id: string; language: string; extra: string[]; missing: string[] }> {
  const db = getDatabase();
  const rows = db.prepare(`SELECT template_id, language, body FROM template_variants`).all() as any[];
  const issues: Array<{ id: string; language: string; extra: string[]; missing: string[] }> = [];
  for (const r of rows) {
    const m = getTemplateMeta(r.template_id);
    if (!m) continue;
    const inBody = new Set([...String(r.body).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((x) => x[1]));
    const canon = new Set(m.canonicalOrder);
    const extra = [...inBody].filter((v) => !canon.has(v));
    const missing = [...canon].filter((v) => !inBody.has(v));
    if (extra.length || missing.length) issues.push({ id: r.template_id, language: r.language, extra, missing });
  }
  return issues;
}
