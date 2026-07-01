/**
 * Runtime key store — persists API keys entered through the Settings UI.
 * Stored in data/keys.json (gitignored). Read on every request so no restart needed.
 * Priority: env var (non-placeholder) > keys.json > empty
 */
import fs from "fs";
import path from "path";

const KEYS_FILE = path.join(process.cwd(), "data", "keys.json");

export type StoredKeys = {
  CHAKRA_API_KEY?: string;
  CHAKRA_PLUGIN_ID?: string;
  CHAKRA_WABA_ID?: string;
  CHAKRA_PHONE_ID?: string;
  CHAKRA_API_VERSION?: string;
  SARVAM_API_KEY?: string;
  SARVAM_MODEL?: string;
  PRODUCTION_TEAM_PHONE?: string;
  CHAKRA_WEBHOOK_SECRET?: string;
};

export function readKeys(): StoredKeys {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, "utf8");
      return JSON.parse(raw) as StoredKeys;
    }
  } catch {
    // corrupt file — ignore
  }
  return {};
}

export function writeKeys(keys: StoredKeys): void {
  const dir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Merge with existing so we don't wipe keys not in this update
  const existing = readKeys();
  const merged = { ...existing, ...keys };
  // Never write empty strings — keep existing value
  for (const [k, v] of Object.entries(merged)) {
    if (!v) delete (merged as Record<string, unknown>)[k];
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(merged, null, 2), "utf8");
}

/** Get a value: env var wins if real, else fall back to keys.json */
export function resolveKey(envKey: keyof NodeJS.ProcessEnv, stored: StoredKeys, storedKey: keyof StoredKeys): string {
  const envVal = process.env[envKey] ?? "";
  if (envVal && !envVal.startsWith("replace_with_")) return envVal;
  return stored[storedKey] ?? "";
}
