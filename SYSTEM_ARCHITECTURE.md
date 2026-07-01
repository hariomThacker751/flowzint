# 🏗️ System Architecture - WhatsApp Integration

## 📊 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER INTERACTION                            │
└─────────────────────────────────────────────────────────────────────────┘

    📱 Customer Phone (919455281616)
         │
         │ Sends WhatsApp message
         │ "Hi, I need bags"
         ↓
    ┌────────────────────────┐
    │  WhatsApp Platform     │
    └────────────────────────┘
         │
         │ Delivered to business number
         ↓
    ┌────────────────────────┐
    │  ChakraHQ WhatsApp     │
    │  Business API          │
    │  +1 (555) 951-8329     │
    └────────────────────────┘
         │
         │ Webhook POST request
         │ Header: x-chakra-signature-256
         │ Body: {phone, name, message, ...}
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                          TUNNEL LAYER                                    │
└─────────────────────────────────────────────────────────────────────────┘

    🌐 Cloudflare Tunnel
    https://abc-xyz-123.trycloudflare.com
         │
         │ HTTPS → HTTP
         │ Public → Private
         ↓
    💻 Your Localhost
    http://localhost:3000
         │
         │ Routes to webhook endpoint
         ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND PROCESSING                              │
└─────────────────────────────────────────────────────────────────────────┘

    📥 /app/api/webhook/customer/route.ts
         │
         ├─ 1. Verify signature (security)
         │     ├─ HMAC-SHA256 validation
         │     └─ Reject if invalid
         │
         ├─ 2. Parse webhook payload
         │     ├─ Extract phone number
         │     ├─ Extract message text
         │     └─ Extract metadata
         │
         ├─ 3. Log to message-log.json
         │     └─ Type: "customer_inbound"
         │
         ├─ 4. Upsert customer
         │     ├─ Check if exists in DB
         │     ├─ Create new if not exists
         │     └─ Update existing if exists
         │
         ├─ 5. Save message
         │     ├─ Insert into chat_messages table
         │     ├─ Role: "user"
         │     └─ Channel: "customer_whatsapp"
         │
         ├─ 6. Check agent state
         │     ├─ Read agent-state.json
         │     ├─ Check agentEnabled
         │     └─ Check raviEnabled
         │
         └─ 7. Trigger Ravi AI (if enabled)
              ↓

    🤖 /lib/server/ravi-agent.ts
         │
         ├─ 1. Load context
         │     ├─ Customer info
         │     ├─ Conversation history
         │     └─ Knowledge base entries
         │
         ├─ 2. Build prompt
         │     ├─ System prompt (from prompts.ts)
         │     ├─ Customer context
         │     ├─ Conversation history
         │     └─ Current message
         │
         ├─ 3. Call Sarvam AI
         │     ├─ POST to Sarvam API
         │     ├─ Model: sarvam-2.0-instruct
         │     └─ Stream response
         │
         ├─ 4. Process response
         │     ├─ Extract AI message
         │     ├─ Parse slots (size, grammage, etc.)
         │     └─ Detect escalation needs
         │
         ├─ 5. Save AI response
         │     ├─ Insert into chat_messages table
         │     ├─ Role: "assistant"
         │     └─ Channel: "customer_whatsapp"
         │
         ├─ 6. Log processing
         │     └─ Type: "ravi_processed"
         │
         └─ 7. Send reply (if auto-send enabled)
              ↓

    📤 /lib/server/chakra-api.ts
         │
         ├─ 1. Check autoSendRaviReplies
         │
         ├─ 2. Call ChakraHQ Send Message API
         │     ├─ POST to ChakraHQ API
         │     ├─ To: customer phone
         │     ├─ From: business number
         │     └─ Body: Ravi's response
         │
         └─ 3. Return success
              ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL DELIVERY                               │
└─────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────┐
    │  ChakraHQ WhatsApp     │
    │  Business API          │
    └────────────────────────┘
         │
         │ Sends WhatsApp message
         ↓
    📱 Customer Phone (919455281616)
         │
         └─ ✅ Receives Ravi's reply

┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND DISPLAY                                │
└─────────────────────────────────────────────────────────────────────────┘

    🖥️ Frontend (http://localhost:3000)
         │
         ├─ Query Loop (every 6 seconds)
         │     ├─ GET /api/customers
         │     ├─ Parse response
         │     └─ Update customer list
         │
         ├─ Customer List Component
         │     ├─ Display all customers
         │     ├─ Show last message
         │     └─ Show message count
         │
         ├─ Customer Selected
         │     ├─ GET /api/customers/chat?customerId=X
         │     ├─ Fetch all messages
         │     └─ Render conversation
         │
         └─ Chat Workspace
              ├─ Display messages (user + AI)
              ├─ Allow owner notes
              └─ Real-time updates

    🔍 Debug Dashboard (http://localhost:3000/debug)
         │
         ├─ Query Loop (every 5 seconds)
         │     └─ GET /api/debug/webhooks
         │
         ├─ Display Sections
         │     ├─ Environment Status
         │     ├─ Agent State
         │     ├─ Customers Table
         │     ├─ Recent Messages
         │     └─ Webhook Events Log
         │
         └─ Auto-refresh for monitoring
```

---

## 🗃️ Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE (SQLite)                               │
│                     data/sales_agent.db                                  │
└─────────────────────────────────────────────────────────────────────────┘

    📊 Table: customers
    ├─ id (TEXT PRIMARY KEY)
    ├─ phone (TEXT UNIQUE)
    ├─ name (TEXT)
    ├─ company (TEXT)
    ├─ gst_number (TEXT)
    ├─ city (TEXT)
    ├─ state (TEXT)
    ├─ language (TEXT)
    ├─ stage (TEXT) → greeting, quoted, confirmed, etc.
    ├─ created_at (DATETIME)
    └─ updated_at (DATETIME)

    💬 Table: chat_messages
    ├─ id (TEXT PRIMARY KEY)
    ├─ customer_id (TEXT) → FK to customers.id
    ├─ channel (TEXT) → "customer_whatsapp" or "owner_whatsapp"
    ├─ role (TEXT) → "user", "assistant", "owner", "system"
    ├─ content (TEXT) → message text
    ├─ created_at (DATETIME)
    └─ metadata (JSON) → optional extra data

    📦 Table: enquiries
    ├─ id (TEXT PRIMARY KEY)
    ├─ customer_id (TEXT) → FK to customers.id
    ├─ slots (JSON) → {size, grammage, quality, color, ...}
    ├─ status (TEXT)
    ├─ created_at (DATETIME)
    └─ updated_at (DATETIME)

    💰 Table: quotes
    ├─ id (TEXT PRIMARY KEY)
    ├─ customer_id (TEXT) → FK to customers.id
    ├─ enquiry_id (TEXT) → FK to enquiries.id
    ├─ base_price (REAL)
    ├─ unit_price (REAL)
    ├─ total_amount (REAL)
    ├─ owner_approved (INTEGER) → 0 or 1
    ├─ product_details (JSON)
    └─ created_at (DATETIME)

    🧠 Table: knowledge_base
    ├─ id (TEXT PRIMARY KEY)
    ├─ key (TEXT)
    ├─ value (TEXT)
    ├─ type (TEXT) → "fact", "rule", "product", etc.
    ├─ scope (TEXT) → "global", "customer", "product"
    ├─ source (TEXT) → "owner", "system", "learned"
    └─ created_at (DATETIME)

┌─────────────────────────────────────────────────────────────────────────┐
│                          RUNTIME FILES (JSON)                            │
│                     data/runtime/                                        │
└─────────────────────────────────────────────────────────────────────────┘

    📝 message-log.json
    [{
      id: "uuid",
      type: "customer_inbound" | "ravi_processed" | "ravi_skipped_disabled" | ...,
      payload: { phone, name, text, result, ... },
      createdAt: "ISO timestamp"
    }, ...]

    ⚙️ agent-state.json
    {
      agentEnabled: true,
      raviEnabled: true,
      autoSendRaviReplies: true,
      outboundSalesEnabled: false,
      updatedAt: "ISO timestamp"
    }
```

---

## 🔌 API Endpoints Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WEBHOOK ENDPOINTS                               │
└─────────────────────────────────────────────────────────────────────────┘

POST /api/webhook/customer
├─ Receives ChakraHQ customer messages
├─ Validates signature
├─ Processes message
├─ Triggers Ravi AI
└─ Returns 200 OK

POST /api/webhook/owner
├─ Receives ChakraHQ owner messages
├─ Validates signature
├─ Saves to database
└─ Returns 200 OK

GET /api/webhook/customer?hub.challenge=X
└─ Returns X (webhook validation)

┌─────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER ENDPOINTS                              │
└─────────────────────────────────────────────────────────────────────────┘

GET /api/customers
├─ Query params: search, stage
├─ Returns: { ok, customers: [...] }
└─ Used by: Frontend customer list

GET /api/customers/chat?customerId=X
├─ Returns: { ok, messages: [...], customer: {...} }
└─ Used by: Frontend chat workspace

POST /api/customers/chat
├─ Body: { customerId, message, role }
├─ Saves message to database
├─ Returns: { ok, id }
└─ Used by: Frontend owner notes

┌─────────────────────────────────────────────────────────────────────────┐
│                          AGENT ENDPOINTS                                 │
└─────────────────────────────────────────────────────────────────────────┘

GET /api/agent/state
├─ Returns: { state: {...}, config: {...} }
└─ Used by: Frontend runtime controls

POST /api/agent/state
├─ Body: { agentEnabled?, raviEnabled?, ... }
├─ Updates agent-state.json
├─ Returns: { ok, state }
└─ Used by: Frontend toggle switches

┌─────────────────────────────────────────────────────────────────────────┐
│                          DEBUG ENDPOINTS                                 │
└─────────────────────────────────────────────────────────────────────────┘

GET /api/debug/webhooks
├─ Returns: {
│    ok,
│    debug: {
│      webhookLog: [...],
│      customers: [...],
│      recentMessages: [...],
│      agentState: {...},
│      environment: {...},
│      timestamp: "..."
│    }
│  }
└─ Used by: Debug dashboard

┌─────────────────────────────────────────────────────────────────────────┐
│                          OTHER ENDPOINTS                                 │
└─────────────────────────────────────────────────────────────────────────┘

GET /api/stats
├─ Returns: { ok, stats: { activeConversations, ... } }
└─ Used by: Dashboard sidebar

GET /api/activity
├─ Query params: limit
├─ Returns: { ok, events: [...] }
└─ Used by: Activity feed

GET /api/knowledge
├─ Query params: scope
├─ Returns: { ok, knowledge: [...] }
└─ Used by: Knowledge base panel

GET /api/quotes
├─ Query params: customerId, status
├─ Returns: { ok, quotes: [...] }
└─ Used by: Quotes page

POST /api/chakra/send
├─ Body: { to, message, type }
├─ Sends WhatsApp via ChakraHQ
└─ Used by: Ravi AI auto-send

GET /api/sarvam/chat
├─ Streaming endpoint for Sarvam AI
└─ Used by: Ravi agent
```

---

## 🧩 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND COMPONENTS                             │
└─────────────────────────────────────────────────────────────────────────┘

app/page.tsx → SalesOS
    │
    ├─ QueryClientProvider
    │   └─ React Query setup
    │
    ├─ AmbientLayer
    │   └─ Visual effects
    │
    ├─ Sidebar
    │   ├─ Logo/Title
    │   ├─ Status Cards
    │   ├─ AgentControls
    │   └─ Navigation Items
    │
    ├─ CustomerList (if activeView === "chats")
    │   ├─ Search Input
    │   └─ Customer Cards
    │       ├─ Avatar
    │       ├─ Name/Company
    │       ├─ Last Message
    │       ├─ Stage Badge
    │       └─ Message Count
    │
    ├─ MainView
    │   └─ Switches based on activeView:
    │       ├─ CommandCenter
    │       ├─ ChatWorkspace
    │       │   ├─ Customer Header
    │       │   ├─ Messages Scroll Area
    │       │   │   └─ LiveMessageBubble[]
    │       │   └─ Input Bar
    │       ├─ QuotesPage
    │       ├─ ProductionPage
    │       ├─ PricingEnginePage
    │       ├─ TemplatesPage
    │       ├─ KnowledgeBasePage
    │       ├─ ActivityPage
    │       ├─ AnalyticsPage
    │       └─ SettingsPage
    │
    └─ RightIntelligencePanel
        ├─ Live AI State
        ├─ Recent Activity
        ├─ AI Memory Events
        └─ Knowledge Insights

app/debug/page.tsx → DebugDashboard
    │
    ├─ QueryClientProvider
    │
    ├─ Header
    │   ├─ Title
    │   └─ Refresh Button
    │
    ├─ Environment Configuration
    │   └─ StatusCard[] (4 cards)
    │
    ├─ Agent Runtime State
    │   └─ StatusCard[] (4 cards)
    │
    ├─ Customers Table
    │   └─ Customer Rows[]
    │       ├─ Phone
    │       ├─ Name
    │       ├─ Company
    │       ├─ Stage Badge
    │       └─ Message Counts
    │
    ├─ Recent Messages
    │   └─ Message Cards[]
    │       ├─ Customer Info
    │       ├─ Role Badge
    │       ├─ Content
    │       └─ Timestamp
    │
    └─ Webhook Events Log
        └─ Event Cards[]
            ├─ Type Badge
            ├─ Timestamp
            └─ Payload (JSON)
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                 │
└─────────────────────────────────────────────────────────────────────────┘

1. Transport Security
   ├─ HTTPS via Cloudflare Tunnel
   ├─ TLS 1.3 encryption
   └─ Certificate managed by Cloudflare

2. Webhook Authentication
   ├─ HMAC-SHA256 signature verification
   ├─ Shared secret (WEBHOOK_SECRET)
   ├─ Header: x-chakra-signature-256
   └─ Reject unsigned webhooks

3. API Key Security
   ├─ Environment variables (.env.local)
   ├─ Never committed to git (.gitignore)
   ├─ Server-side only (not exposed to client)
   └─ Rotatable via ChakraHQ dashboard

4. Database Security
   ├─ Local SQLite file
   ├─ File permissions (OS-level)
   ├─ No external database connection
   └─ Backupable via file copy

5. Input Validation
   ├─ Sanitize user messages
   ├─ Validate phone numbers
   ├─ Type checking (TypeScript)
   └─ SQL parameterized queries

6. Rate Limiting
   ├─ Cloudflare tunnel built-in protection
   ├─ ChakraHQ rate limits
   └─ Frontend debouncing

7. Error Handling
   ├─ No sensitive data in error messages
   ├─ Logged to files (not exposed)
   └─ Generic errors to client
```

---

## ⚡ Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PERFORMANCE METRICS                             │
└─────────────────────────────────────────────────────────────────────────┘

Webhook Processing Time
├─ Signature verification: ~5ms
├─ Database upsert: ~10ms
├─ Message save: ~5ms
├─ Ravi AI call: ~2-5 seconds (Sarvam API)
├─ Reply send: ~500ms (ChakraHQ API)
└─ Total: ~3-6 seconds end-to-end

Frontend Query Intervals
├─ Customer list: 6 seconds
├─ Chat messages: 4 seconds
├─ Dashboard stats: 15 seconds
├─ Debug dashboard: 5 seconds
└─ Agent state: 8 seconds

Database Performance
├─ SQLite read: ~1-5ms
├─ SQLite write: ~5-10ms
├─ No indexes initially (add if needed)
└─ File-based (fast local access)

Scalability
├─ Current: Single user, local dev
├─ Handles: ~100 messages/day easily
├─ Bottleneck: Sarvam API rate limits
└─ Scale: Add Redis cache for production
```

---

## 🔄 State Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          STATE ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────┘

Server State (Source of Truth)
├─ Database: customers, messages, quotes, etc.
├─ Runtime files: agent-state.json, message-log.json
└─ .env.local: configuration

Client State (React)
├─ Zustand Store (useUIStore)
│   ├─ activeView: ViewKey
│   ├─ activeCustomerId: string
│   ├─ collapsed: boolean
│   └─ setters for each
│
├─ React Query Cache
│   ├─ ["customers", search]: Customer[]
│   ├─ ["chat-messages", customerId]: Message[]
│   ├─ ["agent-runtime-state"]: AgentState
│   ├─ ["dashboard-stats"]: Stats
│   ├─ ["debug-webhooks"]: DebugData
│   └─ Auto-refetch intervals
│
└─ Component Local State
    ├─ Input values (draft, search)
    ├─ UI state (loading, modals)
    └─ Form data

State Flow
    User Action (UI)
         ↓
    React Mutation (POST/PUT)
         ↓
    Server Endpoint
         ↓
    Database Update
         ↓
    Query Invalidation
         ↓
    React Query Refetch
         ↓
    UI Update
```

---

## 📦 Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CURRENT DEPLOYMENT                              │
└─────────────────────────────────────────────────────────────────────────┘

Development (Current)
┌─────────────────────────────────────┐
│  Your Windows Machine               │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Next.js Dev Server           │ │
│  │  Port: 3000                   │ │
│  │  ├─ Frontend (React)          │ │
│  │  └─ API Routes (Node.js)      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  SQLite Database              │ │
│  │  data/sales_agent.db          │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Cloudflared Tunnel           │ │
│  │  Random URL each start        │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
         ↓ HTTPS
┌─────────────────────────────────────┐
│  Cloudflare Global Network          │
│  https://xyz.trycloudflare.com      │
└─────────────────────────────────────┘
         ↓ HTTPS
┌─────────────────────────────────────┐
│  ChakraHQ (External Service)        │
│  Webhook sender                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION (FUTURE)                             │
└─────────────────────────────────────────────────────────────────────────┘

Option A: VPS Deployment
├─ Ubuntu/Debian VPS
├─ PM2 process manager
├─ Nginx reverse proxy
├─ PostgreSQL (replace SQLite)
├─ Domain: yourdomain.com
└─ SSL: Let's Encrypt

Option B: Vercel Deployment
├─ Deploy Next.js to Vercel
├─ Replace SQLite with Planetscale/Supabase
├─ Environment variables in Vercel
├─ Auto HTTPS domain
└─ Serverless functions

Option C: Docker Container
├─ Dockerfile for Next.js app
├─ Docker Compose with PostgreSQL
├─ Deploy to AWS/GCP/Azure
├─ Load balancer + auto-scaling
└─ Managed database
```

---

## 🎯 Key Takeaways

### Architecture Benefits
- ✅ Simple local development setup
- ✅ No cloud dependencies (works offline except webhooks)
- ✅ SQLite = zero database config
- ✅ Cloudflare tunnel = free public access
- ✅ Next.js = full-stack in one codebase
- ✅ React Query = automatic caching & refetching
- ✅ TypeScript = type safety throughout

### Architecture Limitations
- ❌ Tunnel URL changes on restart (free tier)
- ❌ SQLite not ideal for production (use Postgres)
- ❌ Single server = no horizontal scaling
- ❌ No redis caching = repeated DB queries
- ❌ File-based logs = no centralized logging

### When to Upgrade
**Production checklist:**
- [ ] > 100 customers using system daily
- [ ] > 1000 messages per day
- [ ] Need multiple team members accessing
- [ ] Need 99.9% uptime SLA
- [ ] Need advanced analytics
- [ ] Need mobile app integration

**Then migrate to:**
- Cloud VPS (DigitalOcean, AWS EC2, etc.)
- PostgreSQL or MongoDB
- Redis for caching
- PM2 or Docker for process management
- Nginx for load balancing
- CI/CD pipeline
- Monitoring (Datadog, New Relic)

---

**This architecture is perfect for MVP and early customers! 🚀**
