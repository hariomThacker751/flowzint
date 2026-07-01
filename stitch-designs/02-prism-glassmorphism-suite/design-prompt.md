# Design 2: PRISM — Glassmorphism Executive Suite

## Stitch Generation Prompt

```
Design a premium glassmorphism executive dashboard for a box manufacturing CEO. Apple-inspired clean aesthetic. Dark mode with frosted glass cards.

LAYOUT: Bento grid — asymmetric modular cards arranged in a flexible grid. No tabs, everything visible. 1440x900 desktop.

TOP ROW — Priority Alerts (auto-hiding when empty):
- Horizontal red-to-amber gradient banner
- 3 alert cards: "Nikhil needs menu reply" (red, escalation), "Confirm ₹1.64L payment — Rahul" (amber), "Confirm ₹83.5K payment — Priya" (amber)
- Each alert: colored dot + text + time + chevron for action

SECOND ROW — 4 KPI Hero Cards:
- "Total Revenue" — ₹12,45,800 — +18.2% green arrow — mini sparkline chart inside card
- "Active Customers" — 54 — +7 this week — mini bar chart
- "Production Util." — 67% — -3% vs last month — donut gauge
- "Avg Order Value" — ₹82,300 — +5.1% — trend line
- Each card: frosted glass (backdrop-blur-xl, bg-white/[0.04], border border-white/10, rounded-2xl, subtle shadow)

THIRD ROW — Bento Grid (2/3 + 1/3 split):
LEFT (2/3) — "Customer Pipeline":
- Horizontal progress bars for each stage: New (12, 22%), Specs (8, 15%), Quoting (5, 9%), Logistics (6, 11%), Confirmed (9, 17%), Production (7, 13%), Complete (7, 13%)
- Each bar: stage label on left, colored progress bar with count, percentage on right
- Colors: slate→blue→amber→indigo→emerald→violet→cyan gradient across stages

RIGHT (1/3) — "Production Overview":
- Large donut gauge: 67% filled, cyan stroke with glow, dark track
- "135T booked / 202T capacity" below
- "June 2026 · 45 corrugators · 150 kg/day each" metadata

FOURTH ROW — Two-column (Orders + Activity Feed):
LEFT — "Recent Orders" table:
- 4 order rows: name, specs, amount, status badge, action button
- Status: confirmed (amber, "Confirm" button), in_production (blue), completed (green)
- Clean table rows with hover highlight

RIGHT — "Live Feed":
- Timeline of recent events with icons in colored circles
- "Ravi replied to Nikhil" (cyan chat icon), "Quote generated ₹83.5K" (violet rupee icon), "Production started Order #8" (green factory icon), "Escalation: Nikhil needs help" (red alert icon)

AI ASSISTANT (floating):
- Sparkles FAB button fixed bottom-right
- Click opens 400px drawer from right edge
- Drawer: "AI Executive Assistant" header, chat messages, input bar
- Glassmorphism drawer with backdrop-blur

COMMAND PALETTE (Cmd+K):
- Modal overlay with search input
- Quick commands: "Show revenue", "Pending payments", "Production capacity", "Customer pipeline", "Create quote", "Open AI assistant"
- Each with icon + shortcut key

STYLE: Apple-inspired premium. Generous whitespace. Subtle animations. Frosted glass everywhere. No harsh borders — everything soft and refined. Professional, calm, confident.

COLORS: Same tokens — cyan #55e6ff primary, violet #8b5cf6 secondary, emerald, amber, red. But more muted and refined than the cyberpunk variant.

DEVICE: Desktop 1440x900
```

## Design DNA (from research)

| Token | Value |
|-------|-------|
| Cards | backdrop-blur-xl, bg-white/[0.04], border-white/10, rounded-2xl |
| Layout | CSS Grid bento — asymmetric, modular |
| Progress bars | Horizontal, colored, with count + percentage labels |
| Donut gauge | SVG circle with dasharray, cyan stroke, glow filter |
| Sparklines | Mini bar/line charts inside KPI cards |
| AI Drawer | Slide-in from right, glassmorphism, backdrop-blur |
| Command palette | Modal overlay, search-first, keyboard shortcuts |
| Alerts | Auto-hiding banner, red-to-amber gradient, inline actions |

## Key Patterns
1. Bento grid — asymmetric cards create visual rhythm
2. Frosted glass on every surface — premium, modern, light
3. Progressive disclosure — alerts → KPIs → details → AI
4. Command palette for power users
5. Floating AI always accessible but not dominant
