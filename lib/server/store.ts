import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "./database";

const runtimeDir = path.join(process.cwd(), "data", "runtime");
const statePath = path.join(runtimeDir, "agent-state.json");
const logPath = path.join(runtimeDir, "message-log.json");
const templatesPath = path.join(runtimeDir, "owner-templates.json");

export type AgentState = {
  agentEnabled: boolean;
  raviEnabled: boolean;
  outboundSalesEnabled: boolean;
  autoSendRaviReplies: boolean;
  // Guidelines v3 §10.2 — configurable cancellation window (default 3 days)
  tokenCancelDays: number;
  updatedAt: string;
};

export type RuntimeLog = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type OwnerTemplate = {
  id: string;
  name: string;
  language: string;
  body: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

const defaultState: AgentState = {
  agentEnabled: false,
  raviEnabled: false,
  outboundSalesEnabled: false,
  autoSendRaviReplies: false,
  tokenCancelDays: 3,
  updatedAt: new Date().toISOString(),
};

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureRuntimeDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function getAgentState(): Promise<AgentState> {
  const saved = await readJson<Partial<AgentState>>(statePath, {});
  return {
    ...defaultState,
    ...saved,
    updatedAt: saved.updatedAt ?? defaultState.updatedAt,
  };
}

export async function updateAgentState(patch: Partial<Omit<AgentState, "updatedAt">>) {
  const current = await getAgentState();
  // Filter out undefined values — otherwise they overwrite existing keys
  // and JSON.stringify drops them entirely, breaking the agent state.
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );
  const next = { ...current, ...cleanPatch, updatedAt: new Date().toISOString() };
  await writeJson(statePath, next);
  return next;
}

export async function appendLog(type: string, payload: unknown) {
  try {
    const db = getDatabase();
    const id = crypto.randomUUID();

    // Determine actor
    let actor: string | null = null;
    if (payload && typeof payload === "object") {
      actor = (payload as any).actor || (payload as any).role || null;
    }
    if (!actor) {
      if (type.includes("customer")) actor = "customer";
      else if (type.includes("owner") || type.includes("Director")) actor = "owner";
      else if (type.includes("ravi")) actor = "ravi";
      else actor = "system";
    }

    // Determine customer_id
    let customerId: string | null = null;
    if (payload && typeof payload === "object") {
      customerId = (payload as any).customerId || (payload as any).customer_id || null;
      if (!customerId) {
        const phone = (payload as any).phone || (payload as any).customerPhone || (payload as any).customer_phone;
        if (phone) {
          const cleanedPhone = String(phone).replace(/[^\d]/g, "");
          const customer = db.prepare("SELECT id FROM customers WHERE phone = ? OR phone LIKE ?").get(cleanedPhone, `%${cleanedPhone}`) as { id: string } | undefined;
          if (customer) {
            customerId = customer.id;
          }
        }
      }
    }

    // Prepare payload string
    let payloadStr = "{}";
    try {
      payloadStr = JSON.stringify(payload);
    } catch (err) {
      payloadStr = JSON.stringify({ error: "Failed to stringify payload", raw: String(payload) });
    }

    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO activity_log (id, event_type, actor, customer_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, type, actor, customerId, payloadStr, createdAt);

    return {
      id,
      type,
      payload,
      createdAt,
    };
  } catch (err) {
    console.error("Failed to append log to SQLite:", err);
    // Return a fallback object to avoid crashing webhook handlers
    return {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function getLogs(): Promise<RuntimeLog[]> {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, event_type as type, payload, created_at as createdAt
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 500
    `).all() as Array<{ id: string; type: string; payload: string | null; createdAt: string }>;

    return rows.map(row => {
      let parsedPayload: unknown = {};
      try {
        parsedPayload = row.payload ? JSON.parse(row.payload) : {};
      } catch {
        parsedPayload = row.payload;
      }
      return {
        id: row.id,
        type: row.type,
        payload: parsedPayload,
        createdAt: row.createdAt
      };
    });
  } catch (err) {
    console.error("Failed to get logs from SQLite:", err);
    return [];
  }
}


export async function getOwnerTemplates() {
  return readJson<OwnerTemplate[]>(templatesPath, []);
}

export async function saveOwnerTemplate(input: {
  id?: string;
  name: string;
  language: string;
  body: string;
  category?: string;
}) {
  const templates = await getOwnerTemplates();
  const now = new Date().toISOString();
  const existingIndex = input.id ? templates.findIndex((template) => template.id === input.id) : -1;
  const next: OwnerTemplate = {
    id: input.id || crypto.randomUUID(),
    name: input.name.trim(),
    language: input.language.trim() || "en",
    body: input.body.trim(),
    category: input.category?.trim() || "UTILITY",
    createdAt: existingIndex >= 0 ? templates[existingIndex].createdAt : now,
    updatedAt: now,
  };

  const nextTemplates = existingIndex >= 0 ? templates.map((template, index) => (index === existingIndex ? next : template)) : [next, ...templates];
  await writeJson(templatesPath, nextTemplates.slice(0, 200));
  await appendLog(existingIndex >= 0 ? "owner_template_updated" : "owner_template_saved", {
    id: next.id,
    name: next.name,
    language: next.language,
  });
  return next;
}

