# Design 3: FORGE — Industrial Manufacturing Command Center

## Stitch Generation Prompt

```
Design an industrial manufacturing command dashboard for a PP woven fabric factory CEO ("Anjani Interweave", Surat, Gujarat). Think Siemens + Naologic — factory floor data meets executive decisions. Dark industrial theme with warm amber and cool blue accents.

LAYOUT: Three-column industrial cockpit. 1440x900 desktop. Full height, no scrolling.

LEFT COLUMN (280px) — Navigation + Live Chat List:
- Dark sidebar with factory iconography
- "ANJANI AI" branding at top with small sparkle animation
- Nav items with icons and live badges:
  - 🏭 Command Center (active, cyan glow left border)
  - 💬 Customer Chats (12 badge)
  - 🧠 Guru AI (3 badge — pending owner inputs)
  - 📋 Quotes (5 badge)
  - ⚙️ Production (67% badge)
  - 💰 Pricing
  - 📊 Analytics
- Below nav: "Runtime" section with agent toggle switches (Ravi On/Off, Auto Reply On/Off)
- Bottom: "Live Customers" mini-list showing online contacts with green dots

CENTER COLUMN (flex-1) — Main Workspace with 3 sections:

SECTION 1 — "Factory Pulse" (top strip):
- 6 KPI cards in a row: Active Chats (12), Quotes Today (5, ₹2.8L), Production (67%), Revenue Pipeline (₹8.5L), Knowledge (128 nodes), Pending Inputs (3, red if > 0)
- Each card: dark industrial card (border-white/10, bg-white/[0.04]), icon, value in bold, subtitle in slate
- Animated number transitions

SECTION 2 — "Production Health" (middle, largest):
- Large area chart showing 7-day factory load (booked vs available in tons)
- X-axis: days of week, Y-axis: tons
- Booked = violet gradient fill, Available = emerald dashed line
- Dark chart grid, glowing data points
- Below chart: "Loom Grid" — 45 small squares representing looms
  - Green = available, Blue = partially booked, Amber = fully booked
  - Hover tooltip: "Loom #12: 85% utilized, Gold quality, 150kg/day"

SECTION 3 — "Orders Pipeline" (bottom):
- Horizontal kanban-style pipeline: Enquiry → Quoting → Confirmed → Production → Complete
- Each column: stage name, count, mini card preview of first order
- Cards draggable (visual only): customer name, specs (size/g/m quality), amount
- "Confirmed" column has amber highlight with "3 awaiting payment" badge

RIGHT COLUMN (340px) — Intelligence Panel:
- "AI Intelligence" header with green "Alive" badge
- "Live AI State" card: Ravi analyzing intent, deterministic backend blocking price, production capacity available
- "Recent Activity" feed: event type + detail + timestamp, streaming live
- "AI Memory Events": knowledge nodes in mini cards with scope badges (customer_visible = green, internal_only = amber)
- Each section: glass card with colored left border accent

STYLE: Industrial meets modern SaaS. Dark backgrounds with warm amber factory-floor lighting accents. Not cold cyberpunk — warm, productive, factory-feel. Concrete and steel meeting glass and light.

COLORS:
- Primary: warm amber/gold (#f59e0b-ish) for factory/production elements
- Secondary: cool blue (#3b82f6) for data/analytics
- AI elements: cyan (#55e6ff) — the one futuristic touch
- Success: emerald green
- Background: dark warm gray (#0f0f12), not pure black
- Cards: subtle warm tint, not cold glass

TYPOGRAPHY: Industrial — slightly condensed feel. Numbers in tabular/monospace for alignment. All caps labels for sections.

DEVICE: Desktop 1440x900
```

## Design DNA (from research)

| Token | Value |
|-------|-------|
| Background | warm dark gray #0f0f12 |
| Cards | border-white/10, bg-warm-gray/[0.04], rounded-xl |
| Primary accent | amber/gold (production, factory) |
| Secondary accent | blue (data, analytics) |
| AI accent | cyan (the futuristic touch) |
| Typography | industrial condensed feel, tabular numbers |
| Charts | area chart with gradient fill, glowing data points |
| Loom grid | 45 squares, color-coded by utilization |

## Key Patterns
1. Three-column industrial cockpit — everything visible
2. Warm factory-floor aesthetic — not cold/cyberpunk
3. Kanban pipeline for orders — visual flow from enquiry to complete
4. Live loom grid visualization — unique to fabric manufacturing
5. Agent runtime controls in sidebar — toggle AI features
6. Production health as the hero section — not revenue, not chat
