import { NextResponse } from "next/server";
import { isPlaceholder } from "@/lib/server/config";

export const runtime = "nodejs";

/**
 * GET /api/debug/config
 * Shows which env vars are set (never exposes actual values, just status)
 */
export async function GET() {
  const keys = [
    { key: "CHAKRA_API_KEY", val: process.env.CHAKRA_API_KEY ?? "" },
    { key: "CHAKRA_PLUGIN_ID", val: process.env.CHAKRA_PLUGIN_ID ?? "" },
    { key: "CHAKRA_WABA_ID", val: process.env.CHAKRA_WABA_ID ?? "" },
    { key: "CHAKRA_PHONE_ID", val: process.env.CHAKRA_PHONE_ID ?? "" },
    { key: "CHAKRA_API_VERSION", val: process.env.CHAKRA_API_VERSION ?? "" },
    { key: "SARVAM_API_KEY", val: process.env.SARVAM_API_KEY ?? "" },
    { key: "PRODUCTION_TEAM_PHONE", val: process.env.PRODUCTION_TEAM_PHONE ?? "" },
  ].map(({ key, val }) => ({
    key,
    status: !val
      ? "MISSING"
      : isPlaceholder(val)
      ? "PLACEHOLDER (needs real value)"
      : "SET ✓",
    preview: val ? (isPlaceholder(val) ? val : `${val.slice(0, 4)}***${val.slice(-4)}`) : "(empty)",
  }));

  const allReady = keys
    .filter((k) => ["CHAKRA_API_KEY", "CHAKRA_PLUGIN_ID", "CHAKRA_PHONE_ID"].includes(k.key))
    .every((k) => k.status === "SET ✓");

  return NextResponse.json({
    ok: allReady,
    envFile: ".env.local (in project root)",
    keys,
    hint: allReady
      ? "All required keys are set. ChakraHQ should work."
      : "Add your real keys to .env.local and restart the app (Ctrl+C, then run START_APP.command again)",
  });
}

