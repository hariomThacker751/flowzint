const db = require('better-sqlite3')('data/sales_agent.db');
const entries = [
  { key: 'company:name', value: 'Anjani Interweave', type: 'fact', scope: 'customer_visible' },
  { key: 'company:location', value: 'Surat, Gujarat', type: 'fact', scope: 'customer_visible' },
  { key: 'rule:minimum_order', value: 'Minimum order quantity is 500 kg', type: 'rule', scope: 'customer_visible' },
  { key: 'rule:loom_capacity', value: 'We are starting a new loom. Currently we have 150 ton capacity of manufacturing available.', type: 'rule', scope: 'customer_visible' }
];
for (const entry of entries) {
  const info = db.prepare("UPDATE knowledge_base SET value = ?, type = ?, scope = ?, updated_at = datetime('now') WHERE key = ?").run(entry.value, entry.type, entry.scope, entry.key);
  if (info.changes === 0) {
    db.prepare("INSERT INTO knowledge_base (id, key, value, type, scope, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'system', datetime('now'), datetime('now'))").run(
      require('crypto').randomUUID(), entry.key, entry.value, entry.type, entry.scope
    );
  }
}
console.log('Knowledge base seeded successfully.');
