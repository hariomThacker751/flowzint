import { loadEnv } from "./envLoader";
import { readKeys, resolveKey } from "./keystore";

loadEnv();

export type RuntimeConfig = {
  chakraApiKey: string;
  chakraPluginId: string;
  chakraWabaId: string;
  chakraPhoneId: string;
  chakraApiVersion: string;
  sarvamApiKey: string;
  sarvamModel: string;
  productionTeamPhone: string;
  webhookSecret: string;
  databaseUrl: string;
};

/** Returns true if value is missing or is an unfilled placeholder */
export function isPlaceholder(val: string): boolean {
  return !val || val.startsWith("replace_with_") || val === "YOUR_API_KEY" || val === "your_key_here";
}

/**
 * getConfig() — called on every API request.
 * Priority: real env var  >  data/keys.json  >  empty string
 * Placeholder env values (replace_with_*) are ignored so keys.json wins.
 */
export function getConfig(): RuntimeConfig {
  const stored = readKeys(); // read fresh every call — no restart needed

  return {
    chakraApiKey:        resolveKey("CHAKRA_API_KEY",        stored, "CHAKRA_API_KEY"),
    chakraPluginId:      resolveKey("CHAKRA_PLUGIN_ID",      stored, "CHAKRA_PLUGIN_ID"),
    chakraWabaId:        resolveKey("CHAKRA_WABA_ID",        stored, "CHAKRA_WABA_ID"),
    chakraPhoneId:       resolveKey("CHAKRA_PHONE_ID",       stored, "CHAKRA_PHONE_ID"),
    chakraApiVersion:    resolveKey("CHAKRA_API_VERSION",    stored, "CHAKRA_API_VERSION") || "v22.0",
    sarvamApiKey:        resolveKey("SARVAM_API_KEY",        stored, "SARVAM_API_KEY"),
    sarvamModel:         resolveKey("SARVAM_MODEL",          stored, "SARVAM_MODEL") || "sarvam-105b",
    productionTeamPhone: resolveKey("PRODUCTION_TEAM_PHONE", stored, "PRODUCTION_TEAM_PHONE")
                         || resolveKey("OWNER_PHONE",         stored, "PRODUCTION_TEAM_PHONE"),
    webhookSecret:       resolveKey("CHAKRA_WEBHOOK_SECRET", stored, "CHAKRA_WEBHOOK_SECRET"),
    databaseUrl:         process.env.DATABASE_URL ?? "",
  };
}

export function getConfigStatus() {
  const config = getConfig();
  return {
    chakraConfigured:      Boolean(config.chakraApiKey && config.chakraPluginId && config.chakraPhoneId),
    sarvamConfigured:      Boolean(config.sarvamApiKey),
    ownerPhoneConfigured:  Boolean(config.productionTeamPhone),
    webhookSecretConfigured: Boolean(config.webhookSecret),
    chakraApiVersion: config.chakraApiVersion,
    sarvamModel: config.sarvamModel,
    missing: {
      chakraApiKey:   !config.chakraApiKey,
      chakraPluginId: !config.chakraPluginId,
      chakraPhoneId:  !config.chakraPhoneId,
      sarvamApiKey:   !config.sarvamApiKey,
    },
  };
}
