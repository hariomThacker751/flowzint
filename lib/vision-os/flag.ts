/**
 * Feature flag for the Vision OS shell (module-host evolution).
 *
 * Default ON — the Vision OS shell is now the primary experience launched by
 * start.bat / `npm run dev`. To roll back to the original dashboard instantly,
 * set NEXT_PUBLIC_VISION_OS="false" in .env.local (no code change needed).
 *
 * Mirrors the established `lib/ops-ui.ts` pattern. NEXT_PUBLIC_ vars are inlined
 * at build time and auto-loaded from .env.local by Next in dev.
 */
export const VISION_OS_ENABLED =
  (process.env.NEXT_PUBLIC_VISION_OS ?? "true").toString().toLowerCase() !== "false";
