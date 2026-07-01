# Design 1: AURA — AI-First Cyberpunk Command Center

## Stitch Generation Prompt

```
Design a dark cyberpunk AI CEO dashboard for a box manufacturing company called "Flowzint Interweave". 

BACKGROUND: Deep void black (#0a0a0f) with subtle radial gradient overlays. Floating ambient particles. Optional CRT scanline overlay at 5% opacity for texture.

LAYOUT: Single-page, no scrolling. Top 20% = KPI strip (4 cards in a row). Center 60% = AI chat panel as hero element with glowing border. Right 20% = live activity feed column.

AI CHAT PANEL (center hero):
- Frosted glass dark card with cyan (#55e6ff) glowing border accent
- Chat messages: user messages right-aligned with cyan gradient, AI messages left-aligned with violet (#8b5cf6) tint
- Input area at bottom with "Ask anything about your business..." placeholder
- Suggestion chips below input: "Show revenue", "Pending orders", "Production status", "Create quote"
- Animated pulsing dot showing "AI Active" status
- Sparkles icon badge

TOP KPI STRIP (4 cards in row):
- Card 1: "Today's Revenue" — ₹45,200 — green up arrow +12% — Indian Rupee icon
- Card 2: "Active Chats" — 12 — "3 new" badge — Message icon  
- Card 3: "Production" — 67% utilization gauge — Factory icon
- Card 4: "Pipeline" — ₹8.5L — "30 days" — Chart icon
- Each card: glassmorphism (dark translucent bg, thin white/10 border, rounded-xl, subtle hover glow)

RIGHT PANEL (320px):
- "Live Activity" section with streaming event list
- Each event: small colored dot + event text + time ago
- Color coding: green=payment, red=escalation, blue=order, violet=AI
- "AI Memory" section below with knowledge nodes (key → value pairs in tiny cards)

TYPOGRAPHY: Clean sans-serif, white text on dark, slate-400/500 for secondary text. Numbers in bold white.

COLORS: Primary cyan #55e6ff, secondary violet #8b5cf6, success emerald #38ef7d, warning amber, danger red.

STYLE: Cyberpunk meets professional SaaS. Dark mode only. Neon accents on key data. Glassmorphism cards with subtle blurs. Modern, premium, AI-native feel.

DEVICE: Desktop 1440x900
```

## Design DNA (from research)

| Token | Value |
|-------|-------|
| Background | `bg-void` #0a0a0f |
| Cards | glassmorphism: border-white/10, bg-white/[0.04], backdrop-blur |
| Primary accent | cyan #55e6ff (AI elements, active states, glow) |
| Secondary accent | violet #8b5cf6 (knowledge, memory, Guru) |
| Success | emerald #38ef7d (online, confirmed, production) |
| Warning | amber (pipeline, pending) |
| Danger | red #ef4444 (escalations, attention) |
| Typography | text-white headings, text-slate-400 body, text-xs for metadata |
| Animations | framer-motion fade/slide, pulse-ring on active indicators |

## Key Patterns
1. AI chat as THE interface — not a sidebar, the hero
2. Cyberpunk aesthetic — particles, glow effects, dark ambiance
3. KPI strip always visible above the fold
4. Activity streams live in right panel
5. Glassmorphism cards throughout
