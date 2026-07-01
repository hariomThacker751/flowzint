/**
 * Feature flag for the v2 "Operations" UI layer (Phase 0–4 backend surfacing).
 *
 * Default ON. Set NEXT_PUBLIC_OPS_UI="false" to instantly hide every new nav
 * section + view and restore the original dashboard exactly — a clean rollback
 * with no code changes. (NEXT_PUBLIC_ vars are inlined at build time.)
 */
export const OPS_UI_ENABLED =
  (process.env.NEXT_PUBLIC_OPS_UI ?? "true").toString().toLowerCase() !== "false";
