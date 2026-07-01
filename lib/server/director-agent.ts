import { sarvamChat, type ChatMessage } from './sarvam';
import { DIRECTOR_SYSTEM_PROMPT } from './prompts';
import { storeKnowledge, getAllKnowledge } from './catalog';
import { getDatabase } from './database';
import {
  getAllMonthlyCapacities,
  getCorrugatorFloorConfig,
  updateCorrugatorFloorConfig,
  calculateEta,
  MONTHLY_CAPACITY_KG,
  TOTAL_CORRUGATORS,
} from './corrugator-capacity';
import { appendLog } from './store';

interface DirectorMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DirectorResponse {
  reply: string;
  memoryCandidate?: {
    key: string;
    value: string;
    type: 'fact' | 'rule' | 'table' | 'template';
    scope: 'customer_visible' | 'internal_only';
  };
}

/**
 * Build a comprehensive database context snapshot so Director can answer
 * ANY question about sales, production, customers, orders, pricing — instantly.
 */
export function buildDatabaseContext(): string {
  const db = getDatabase();

  // Customers
  const allCustomers = db.prepare(`
    SELECT name, phone, company, city, stage 
    FROM customers WHERE stage != 'owner'
  `).all() as any[];

  const customersByStage = db.prepare(`
    SELECT stage, COUNT(*) as c FROM customers WHERE stage != 'owner' GROUP BY stage ORDER BY c DESC
  `).all() as Array<{ stage: string; c: number }>;

  // Enquiries / Orders
  const totalEnquiries = (db.prepare("SELECT COUNT(*) as c FROM enquiries").get() as any).c;
  const enquiriesByStatus = db.prepare(`
    SELECT status, COUNT(*) as c, COALESCE(SUM(quantity_kg), 0) as kg
    FROM enquiries GROUP BY status ORDER BY c DESC
  `).all() as Array<{ status: string; c: number; kg: number }>;

  // Recent orders (Expanded to 50 for deep querying)
  const recentOrders = db.prepare(`
    SELECT e.size_inches, e.grammage, e.quality, e.color, e.lamination,
           e.quantity_kg, e.status, e.delivery_city, c.name, c.phone
    FROM enquiries e JOIN customers c ON e.customer_id = c.id
    ORDER BY e.created_at DESC LIMIT 50
  `).all() as any[];

  // Quotes (Expanded)
  const quoteStats = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(total_amount), 0) as pipeline,
           SUM(CASE WHEN owner_approved = 0 THEN 1 ELSE 0 END) as pending
    FROM quotes WHERE created_at >= datetime('now', '-30 days')
  `).get() as any;

  const recentQuotes = db.prepare(`
    SELECT q.id, q.unit_price, q.total_amount, q.owner_approved, c.name
    FROM quotes q JOIN customers c ON q.customer_id = c.id
    ORDER BY q.created_at DESC LIMIT 20
  `).all() as any[];

  // Production / capacity
  const caps = getAllMonthlyCapacities();
  const currentCap = caps[0] || { monthKey: '', totalKg: MONTHLY_CAPACITY_KG, bookedKg: 0, availableKg: MONTHLY_CAPACITY_KG, utilizationPct: 0, activeBookings: 0 };

  // Corrugator bookings
  const corrugatorBookings = db.prepare(`
    SELECT lb.month_key, lb.kg_booked, lb.status, lb.delivery_estimate_days,
           c.name as customer_name
    FROM corrugator_bookings lb LEFT JOIN customers c ON lb.customer_id = c.id
    WHERE lb.status IN ('booked', 'in_production')
    ORDER BY lb.created_at DESC LIMIT 20
  `).all() as any[];

  // Knowledge base summary
  const knowledgeCount = (db.prepare("SELECT COUNT(*) as c FROM knowledge_base").get() as any).c;

  // Activity today
  const todayActivity = (db.prepare(`
    SELECT COUNT(*) as c FROM activity_log WHERE created_at >= date('now')
  `).get() as any).c;

  // Today's Sales and Quotes (created today)
  const todayQuotes = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(total_amount), 0) as pipeline,
      SUM(CASE WHEN owner_approved = 1 THEN 1 ELSE 0 END) as approved_count,
      COALESCE(SUM(CASE WHEN owner_approved = 1 THEN total_amount ELSE 0 END), 0) as approved_value
    FROM quotes 
    WHERE created_at >= date('now')
  `).get() as any;

  // Today's Enquiries
  const todayEnquiries = db.prepare(`
    SELECT e.id, c.name 
    FROM enquiries e LEFT JOIN customers c ON e.customer_id = c.id
    WHERE e.created_at >= date('now')
  `).all() as any[];

  // Pricing
  const priceConfig = db.prepare("SELECT * FROM price_config ORDER BY effective_date DESC LIMIT 1").get() as any;

  // Pending Escalations
  const pendingEscalations = db.prepare(`
    SELECT id, customer_phone, customer_name, question, created_at 
    FROM pending_escalations 
    WHERE status = 'pending' 
    ORDER BY created_at DESC 
    LIMIT 10
  `).all() as any[];

  let context = `\n\n=== DATABASE SNAPSHOT (live, use this data) ===\n\n`;

  if (pendingEscalations.length > 0) {
    context += `[!] PENDING CUSTOMER ESCALATIONS (Needs your answer):\n`;
    pendingEscalations.forEach((e: any) => {
      context += `- ID: ${e.id}\n  Customer: ${e.customer_name} (${e.customer_phone})\n  Question: "${e.question}"\n  Time: ${e.created_at}\n\n`;
    });
  }

  context += `TODAY'S SUMMARY:\n`;
  context += `- New Enquiries: ${todayEnquiries.length} ${todayEnquiries.length > 0 ? '(' + todayEnquiries.map((e: any) => e.name || 'Unknown').join(', ') + ')' : ''}\n`;
  context += `- New Quotes Generated: ${todayQuotes.total} (Total value: ₹${(todayQuotes.pipeline || 0).toLocaleString('en-IN')})\n`;
  context += `- Confirmed/Approved Sales Today: ${todayQuotes.approved_count} orders (Total value: ₹${(todayQuotes.approved_value || 0).toLocaleString('en-IN')})\n`;
  context += `- Today's Activity Events: ${todayActivity}\n\n`;

  context += `CUSTOMERS DIRECTORY (${allCustomers.length} total):\n`;
  context += `Summary by stage: ${customersByStage.map((s: any) => `${s.stage}=${s.c}`).join(', ') || 'none'}\n`;
  if (allCustomers.length > 0) {
    context += `List: ${allCustomers.map((c: any) => `${c.name || 'Unknown'} (${c.city || 'No city'}, ${c.stage})`).join(' | ')}\n\n`;
  } else {
    context += `No customers yet.\n\n`;
  }

  context += `ALL RECENT ORDERS (${totalEnquiries} lifetime):\n`;
  context += `Summary by status: ${enquiriesByStatus.map((s: any) => `${s.status}=${s.c}(${s.kg}kg)`).join(', ') || 'none'}\n`;
  if (recentOrders.length > 0) {
    context += `Detailed List (Top 50): \n`;
    recentOrders.forEach((o: any) => {
      context += `- ${o.name}: ${o.size_inches}" ${o.grammage}g ${o.quality} (${o.color}, ${o.lamination}) -> ${o.quantity_kg}kg [Status: ${o.status}] City: ${o.delivery_city}\n`;
    });
    context += `\n`;
  } else {
    context += `No orders yet.\n\n`;
  }

  context += `QUOTES OVERVIEW (Last 30 days):\n`;
  context += `Total: ${quoteStats.total}, Pipeline: ₹${(quoteStats.pipeline || 0).toLocaleString('en-IN')}, Pending Approval: ${quoteStats.pending}\n`;
  if (recentQuotes.length > 0) {
    context += `Recent Quotes: ${recentQuotes.map((q: any) => `${q.name}: ₹${q.total_amount.toLocaleString('en-IN')} [Approved: ${q.owner_approved ? 'Yes' : 'No'}]`).join(' | ')}\n\n`;
  } else {
    context += `No recent quotes.\n\n`;
  }

  context += `PRODUCTION: ${TOTAL_CORRUGATORS} corrugators total\n`;
  const floor = getCorrugatorFloorConfig();
  context += `CORRUGATOR FLOOR (live — digital twin of the factory floor):\n`;
  context += `- FREE right now: ${floor.corrugators_available} corrugators (available for new orders)\n`;
  context += `- On system orders: ${floor.corrugators_in_system} corrugators\n`;
  context += `- On external/offline orders: ${floor.corrugators_external} corrugators\n`;
  context += `- In maintenance/breakdown: ${floor.corrugators_maintenance} corrugators\n`;
  context += `- Effective monthly capacity: ${(floor.corrugators_available * 150 * 30).toLocaleString()} kg (free corrugators × 150 × 30)\n`;
  context += `- Last updated by ${floor.updated_by}: ${floor.notes || '—'} at ${floor.updated_at}\n`;
  context += `Current bookings: ${currentCap.bookedKg.toLocaleString()}kg booked (${currentCap.utilizationPct}%), ${currentCap.availableKg.toLocaleString()}kg available this month\n`;
  if (corrugatorBookings.length > 0) {
    context += `Active bookings: ${corrugatorBookings.map((b: any) => `${b.customer_name}: ${b.kg_booked}kg [${b.status}] ~${b.delivery_estimate_days}d`).join(' | ')}\n`;
  } else {
    context += `No active corrugator bookings\n`;
  }
  context += `\n`;
  context += `To update the corrugator floor, reply with EXACTLY one of these on its own line (the owner uses these to keep the digital twin in sync with reality):\n`;
  context += `- CORRUGATOR_FLOOR: available=<N> maintenance=<N> external=<N>   (e.g. CORRUGATOR_FLOOR: available=30 maintenance=3 external=5)\n`;
  context += `- CORRUGATOR_FLOOR: external=+3  (3 corrugators now busy with an offline order → available drops by 3)\n`;
  context += `- CORRUGATOR_FLOOR: maintenance=+2  (2 corrugators down for repair)\n`;
  context += `When the floor changes, ALL future capacity, ETA and dispatch calculations automatically recompute from the new free-corrugator count.\n\n`;

  context += `KNOWLEDGE BASE: ${knowledgeCount} entries\n`;

  if (priceConfig) {
    context += `PRICING: Base 3g = ₹${priceConfig.base_price_3g || priceConfig.base_price_silver || 'N/A'}/kg\n`;
    if (priceConfig.base_price_gold) context += `  Gold quality = ₹${priceConfig.base_price_gold}/kg\n`;
    if (priceConfig.base_price_platinum) context += `  Platinum quality = ₹${priceConfig.base_price_platinum}/kg\n`;
  }

  context += `\n=== END SNAPSHOT ===\n\n`;
  context += `Use this data to answer the owner's question accurately. If the data doesn't have the answer, say so honestly — don't guess.`;

  return context;
}

/**
 * Detect & apply a CORRUGATOR_FLOOR update command from the owner or from Director's reply.
 * Supports absolute ("available=30") and relative ("external=+3", "maintenance=-1").
 * Returns a human-readable confirmation if applied, else null.
 *
 * This is what makes the agent a digital twin: the owner says "5 corrugators busy with
 * an offline order" and the live floor + capacity + ETA all update instantly.
 */
function applyCorrugatorFloorCommand(text: string): string | null {
  const match = text.match(/CORRUGATOR_FLOOR:\s*(.+)/i);
  if (!match) return null;

  const payload = match[1].trim();
  const current = getCorrugatorFloorConfig();
  let nextAvailable = current.corrugators_available;
  let nextMaint = current.corrugators_maintenance;
  let nextExternal = current.corrugators_external;

  const tokens = payload.split(/\s+/);
  let changed = false;
  for (const tok of tokens) {
    const m = tok.match(/^(available|maintenance|external)\s*=\s*([+-]?\d+)/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const raw = Number(m[2]);
    let value: number;
    if (raw >= 0) {
      // absolute set
      value = Math.max(0, Math.min(TOTAL_CORRUGATORS, Math.round(raw)));
    } else {
      // relative decrement
      const base = field === 'available' ? current.corrugators_available
        : field === 'maintenance' ? current.corrugators_maintenance
        : current.corrugators_external;
      value = Math.max(0, Math.min(TOTAL_CORRUGATORS, Math.round(base + raw)));
    }

    if (field === 'available') nextAvailable = value;
    else if (field === 'maintenance') nextMaint = value;
    else if (field === 'external') nextExternal = value;
    changed = true;
  }

  if (!changed) return null;

  // If only external/maintenance were changed (relative +N), also adjust available
  // so the floor stays balanced: external=+3 ⇒ available -= 3.
  const usedRelativeExt = /external\s*=\s*\+\d+/i.test(payload);
  const usedRelativeMaint = /maintenance\s*=\s*\+\d+/i.test(payload);
  if (!/available\s*=/i.test(payload)) {
    if (usedRelativeExt) nextAvailable = Math.max(0, current.corrugators_available - (nextExternal - current.corrugators_external));
    if (usedRelativeMaint) nextAvailable = Math.max(0, current.corrugators_available - (nextMaint - current.corrugators_maintenance));
  }

  const updated = updateCorrugatorFloorConfig({
    corrugators_available: nextAvailable,
    corrugators_maintenance: nextMaint,
    corrugators_external: nextExternal,
    updated_by: 'owner',
    notes: 'Updated via Director command',
  });

  void appendLog('Director_corrugator_floor_update', {
    before: current,
    after: updated,
    command: payload,
  });

  const effMonthly = updated.corrugators_available * 150 * 30;
  return `✅ Corrugator floor updated — ${updated.corrugators_available} free / ${updated.corrugators_in_system} on system orders / ${updated.corrugators_external} external / ${updated.corrugators_maintenance} maintenance. Effective monthly capacity now ${(effMonthly / 1000).toFixed(1)}T. All capacity, ETA and dispatch calculations have been recomputed.`;
}

export class DirectorAgent {
  /**
   * Process owner message with full database context
   */
  async processOwnerMessage(
    ownerPhone: string,
    message: string,
    conversationHistory: DirectorMessage[] = []
  ): Promise<DirectorResponse> {
    // Build database context snapshot
    const dbContext = buildDatabaseContext();

    // Build conversation context with DB data
    const messages: ChatMessage[] = [
      { role: 'system', content: `${DIRECTOR_SYSTEM_PROMPT}\n\n${dbContext}` },
      ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message }
    ];

    // Call Sarvam API
    const response = await sarvamChat(messages, { temperature: 0.2, maxTokens: 800, enableReasoning: false });

    // Parse response for memory candidates
    const memoryCandidate = this.extractMemoryCandidate(response.content);

    // Apply a corrugator-floor update if the owner typed the command directly, OR if
    // Director emitted one in its reply (keeps the digital twin synced with the floor).
    let finalReply = response.content.replace(/CORRUGATOR_FLOOR:\s*.+/gi, '').trim();
    const floorUpdate = applyCorrugatorFloorCommand(message) ?? applyCorrugatorFloorCommand(response.content);
    if (floorUpdate) {
      finalReply = `${floorUpdate}\n\n${finalReply}`.trim();
    }

    // Store message in database
    await this.storeMessage(ownerPhone, message, finalReply);

    return {
      reply: finalReply,
      memoryCandidate
    };
  }

  /**
   * Extract memory candidate from Director response
   */
  private extractMemoryCandidate(response: string): DirectorResponse['memoryCandidate'] | undefined {
    const keyMatch = response.match(/MEMORY_KEY:\s*(.+)/);
    const valueMatch = response.match(/MEMORY_VALUE:\s*(.+)/);
    const typeMatch = response.match(/MEMORY_TYPE:\s*(fact|rule|table|template)/);
    const scopeMatch = response.match(/SCOPE:\s*(customer_visible|internal_only)/);

    if (keyMatch && valueMatch && typeMatch && scopeMatch) {
      return {
        key: keyMatch[1].trim(),
        value: valueMatch[1].trim(),
        type: typeMatch[1] as 'fact' | 'rule' | 'table' | 'template',
        scope: scopeMatch[1] as 'customer_visible' | 'internal_only'
      };
    }

    return undefined;
  }

  /**
   * Store memory candidate in knowledge base
   */
  async storeMemory(
    key: string,
    value: string,
    type: 'fact' | 'rule' | 'table' | 'template',
    scope: 'customer_visible' | 'internal_only',
    source: string = 'owner'
  ): Promise<void> {
    storeKnowledge({ key, value, type, scope, source });
  }

  /**
   * Query knowledge base (Director can see all scopes)
   */
  async queryKnowledge(type?: string): Promise<any[]> {
    return getAllKnowledge('all', type);
  }

  /**
   * Store message in chat_messages table
   */
  private async storeMessage(phone: string, userMessage: string, assistantMessage: string): Promise<void> {
    const db = getDatabase();

    let ownerCustomer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone) as any;
    if (!ownerCustomer) {
      const customerId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO customers (id, phone, name, language, stage)
        VALUES (?, ?, ?, 'en', 'owner')
      `).run(customerId, phone, "Owner");
      ownerCustomer = { id: customerId };
    }

    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content, metadata)
      VALUES (?, ?, 'owner_whatsapp', 'user', ?, ?)
    `).run(crypto.randomUUID(), ownerCustomer.id, userMessage, JSON.stringify({ agent: 'Director' }));

    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, channel, role, content, metadata)
      VALUES (?, ?, 'owner_whatsapp', 'assistant', ?, ?)
    `).run(crypto.randomUUID(), ownerCustomer.id, assistantMessage, JSON.stringify({ agent: 'Director' }));
  }

  /**
   * Get conversation history for owner
   */
  async getConversationHistory(ownerPhone: string, limit: number = 10): Promise<DirectorMessage[]> {
    const db = getDatabase();

    const ownerCustomer = db.prepare("SELECT id FROM customers WHERE phone = ?").get(ownerPhone) as { id: string } | undefined;
    if (!ownerCustomer) return [];

    const messages = db.prepare(`
      SELECT role, content FROM chat_messages
      WHERE customer_id = ? AND channel = 'owner_whatsapp'
      ORDER BY created_at DESC LIMIT ?
    `).all(ownerCustomer.id, limit) as Array<{ role: string; content: string }>;

    return messages.reverse().map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
  }
}

