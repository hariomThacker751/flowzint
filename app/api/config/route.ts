import { NextResponse } from "next/server";
import { readKeys, writeKeys, StoredKeys } from "@/lib/server/keystore";
import { getConfig, isPlaceholder } from "@/lib/server/config";

export const runtime = "nodejs";

const KEY_LABELS: Record<string, string> = {
  CHAKRA_API_KEY:        "ChakraHQ API Key",
  CHAKRA_PLUGIN_ID:      "ChakraHQ Plugin ID",
  CHAKRA_WABA_ID:        "Meta WABA ID",
  CHAKRA_PHONE_ID:       "WhatsApp Phone ID",
  CHAKRA_API_VERSION:    "API Version",
  SARVAM_API_KEY:        "Sarvam AI Key",
  SARVAM_MODEL:          "Sarvam Model",
  PRODUCTION_TEAM_PHONE: "Owner Phone",
  CHAKRA_WEBHOOK_SECRET: "Webhook Secret",
};

/** GET /api/config — returns key status (never the real values) */
export async function GET() {
  const config = getConfig();
  const stored = readKeys();

  const fields = Object.keys(KEY_LABELS).map((key) => {
    const configKey = key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof typeof config;
    const val = (config as Record<string, string>)[configKey] ?? "";
    const fromStore = Boolean((stored as Record<string, string | undefined>)[key]);
    const fromEnv = Boolean(process.env[key] && !isPlaceholder(process.env[key] ?? ""));

    return {
      key,
      label: KEY_LABELS[key],
      configured: Boolean(val),
      source: val ? (fromEnv ? "env" : fromStore ? "saved" : "default") : "missing",
      preview: val ? `${val.slice(0, 4)}${"*".repeat(Math.max(0, val.length - 8))}${val.slice(-4)}` : "",
    };
  });

  const allRequired = ["CHAKRA_API_KEY", "CHAKRA_PLUGIN_ID", "CHAKRA_PHONE_ID"];
  const ready = allRequired.every((k) => fields.find((f) => f.key === k)?.configured);

  return NextResponse.json({ ok: true, ready, fields });
}

/** POST /api/config — save keys entered from Settings UI to data/keys.json */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Only accept known keys, strip empties
    const toSave: StoredKeys = {};
    for (const key of Object.keys(KEY_LABELS) as (keyof StoredKeys)[]) {
      const val = (body[key] ?? "").trim();
      if (val) (toSave as Record<string, string>)[key] = val;
    }

    writeKeys(toSave);

    // Verify it worked by re-reading config
    const config = getConfig();
    const chakraReady = Boolean(config.chakraApiKey && config.chakraPluginId && config.chakraPhoneId);

    return NextResponse.json({
      ok: true,
      saved: Object.keys(toSave).length,
      chakraReady,
      message: chakraReady
        ? "Keys saved. ChakraHQ is now configured — chats will load automatically."
        : "Keys saved. Add CHAKRA_API_KEY, CHAKRA_PLUGIN_ID, and CHAKRA_PHONE_ID to enable chat.",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

