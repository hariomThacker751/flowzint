/**
 * Catalog & Knowledge service — the single access point (facade).
 *
 * Phase 4a consolidation. This is a THIN FACADE over the existing
 * `box-knowledge` catalog and the `knowledge_base` store. There is NO
 * behavior change: it only unifies the previously scattered imports so callers
 * depend on `@/lib/server/catalog` instead of reaching into individual files.
 *
 * This is the seam: later we can move the catalog's data into the database
 * behind this same interface WITHOUT touching any caller. Until then, the
 * 4,561-line `box-knowledge.ts` remains the data source unchanged.
 */

// ── Box catalog has been removed. ──────────────

// ── Knowledge base (data source: knowledge_base table) ───────────────────────
export {
  queryKnowledge,
  queryKnowledgeByPattern,
  storeKnowledge,
  getAllKnowledge,
  deleteKnowledge,
} from "../knowledge-base";
