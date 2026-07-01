import { getDatabase } from "./database";

export type KnowledgeEntry = {
  id: string;
  key: string;
  value: string;
  type: "fact" | "rule" | "table" | "template";
  scope: "customer_visible" | "internal_only";
  source: string;
  created_at: string;
  updated_at: string;
};

export type KnowledgeScope = "customer_visible" | "internal_only" | "all";

export function queryKnowledge(key: string, scope: KnowledgeScope = "all"): KnowledgeEntry | null {
  const db = getDatabase();
  
  let query = "SELECT * FROM knowledge_base WHERE key = ?";
  const params: any[] = [key];
  
  if (scope !== "all") {
    query += " AND scope = ?";
    params.push(scope);
  }
  
  const result = db.prepare(query).get(...params) as KnowledgeEntry | undefined;
  return result || null;
}

export function queryKnowledgeByPattern(pattern: string, scope: KnowledgeScope = "all"): KnowledgeEntry[] {
  const db = getDatabase();
  
  let query = "SELECT * FROM knowledge_base WHERE key LIKE ?";
  const params: any[] = [`%${pattern}%`];
  
  if (scope !== "all") {
    query += " AND scope = ?";
    params.push(scope);
  }
  
  query += " ORDER BY created_at DESC";
  
  return db.prepare(query).all(...params) as KnowledgeEntry[];
}

export function storeKnowledge(input: {
  key: string;
  value: string;
  type: "fact" | "rule" | "table" | "template";
  scope?: "customer_visible" | "internal_only";
  source?: string;
}): string {
  const db = getDatabase();
  
  // Check if key already exists
  const existing = db.prepare("SELECT id, created_at FROM knowledge_base WHERE key = ?").get(input.key) as 
    { id: string; created_at: string } | undefined;
  
  if (existing) {
    // Update existing entry, preserve created_at
    db.prepare(`
      UPDATE knowledge_base 
      SET value = ?, type = ?, scope = ?, source = ?, updated_at = datetime('now')
      WHERE key = ?
    `).run(
      input.value,
      input.type,
      input.scope || "internal_only",
      input.source || "owner",
      input.key
    );
    return existing.id;
  } else {
    // Create new entry
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO knowledge_base (id, key, value, type, scope, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.key,
      input.value,
      input.type,
      input.scope || "internal_only",
      input.source || "owner"
    );
    return id;
  }
}

export function getAllKnowledge(scope: KnowledgeScope = "all", type?: string): KnowledgeEntry[] {
  const db = getDatabase();
  
  let query = "SELECT * FROM knowledge_base WHERE 1=1";
  const params: any[] = [];
  
  if (scope !== "all") {
    query += " AND scope = ?";
    params.push(scope);
  }
  
  if (type) {
    query += " AND type = ?";
    params.push(type);
  }
  
  query += " ORDER BY updated_at DESC";
  
  return db.prepare(query).all(...params) as KnowledgeEntry[];
}

export function deleteKnowledge(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM knowledge_base WHERE id = ?").run(id);
  return result.changes > 0;
}
