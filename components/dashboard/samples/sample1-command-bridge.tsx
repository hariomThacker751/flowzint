'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Search, Bot, Brain, Zap, ChartNoAxesCombined,
  MessageCircle, Factory, BadgeIndianRupee, ArrowUpRight, CircleDot,
  ChevronRight, MessageSquareText, Database,
  AlertTriangle, CheckCircle, Clock3, Gauge, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ─── Sample 1: "Command Bridge" — AI Chat is the Hero ──────────────
   Design philosophy: The AI IS the interface. Instead of hunting through
   tabs and menus, the CEO types natural language commands. "Show me today's
   revenue." "What orders need attention?" "Create a quote for 36 inch."
   The AI responds with structured data cards inline — no page navigation.
   ─────────────────────────────────────────────────────────────────── */

interface KPIData {
  label: string; value: string; delta: string; icon: React.ElementType; tone: string;
}

export function CommandBridge() {
  const [command, setCommand] = useState('');
  const [messages, setMessages] = useState<Array<{role: string; content: string; cards?: any[]}>>([
    {
      role: 'assistant',
      content: "Good morning, Puneet. Here's your business at a glance. You have **3 escalations** needing your input and **2 payments** to confirm. What would you like to do?",
      cards: []
    }
  ]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const kpiCards: KPIData[] = [
    { label: "Today's Revenue", value: "₹45,200", delta: "+12% vs yesterday", icon: BadgeIndianRupee, tone: "cyan" },
    { label: "Active Chats", value: "12", delta: "3 new this hour", icon: MessageCircle, tone: "violet" },
    { label: "Production", value: "67%", delta: "135T / 202T booked", icon: Factory, tone: "green" },
    { label: "Pipeline", value: "₹8.5L", delta: "30-day total", icon: ChartNoAxesCombined, tone: "amber" },
  ];

  const suggestions = [
    "Show orders needing payment confirmation",
    "What's the production capacity for next month?",
    "Find customer Nikhil's conversation",
    "Create a quote for 36\" 150 GSM 5-Ply 800kg",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!command.trim() || sending) return;
    const userMsg = command.trim();
    setCommand('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    // Simulate AI processing
    setTimeout(() => {
      const response = generateMockResponse(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', ...response }]);
      setSending(false);
    }, 800);
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Bento KPI Grid Above Chat ── */}
      <div className="px-6 pt-6 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-strong rounded-xl p-4 group cursor-pointer hover:border-cyan/30 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">{card.label}</span>
                <card.icon className={cn("h-4 w-4", card.tone === 'cyan' ? 'text-cyan' : card.tone === 'violet' ? 'text-violet-300' : card.tone === 'green' ? 'text-emerald-400' : 'text-amber-300')} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                {card.delta}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── AI Command Chat ── */}
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <div className="glass-strong rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden border-white/10">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 shadow-glow">
              <Sparkles className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">AI CEO Assistant</div>
              <div className="text-xs text-slate-500">Query database · Create orders · Search conversations</div>
            </div>
            <Badge tone="green" className="ml-auto">Online</Badge>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 mt-1">
                    <Bot className="h-4 w-4 text-cyan" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3",
                  msg.role === 'user'
                    ? "rounded-tr-sm bg-gradient-to-br from-cyan/20 to-violet/15 border border-cyan/20 text-white"
                    : "rounded-tl-sm bg-white/[0.06] border border-white/10 text-slate-100"
                )}>
                  <p className="text-sm leading-6 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10">
                  <Bot className="h-4 w-4 text-cyan" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 px-4 py-3">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="flex gap-1.5"
                  >
                    <span className="h-2 w-2 rounded-full bg-cyan" />
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </motion.div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Command Input */}
          <div className="border-t border-white/10 p-4">
            {/* Suggestions */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setCommand(s)}
                  className="text-xs text-slate-400 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 hover:border-cyan/30 hover:text-cyan transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 focus-within:border-cyan/40 transition-all">
              <Search className="h-4 w-4 text-slate-500 shrink-0" />
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask anything: orders, customers, production, create quotes..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 text-white"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 hidden sm:block">Enter to send</span>
                <Button size="icon" onClick={handleSend} disabled={!command.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-cyan/10 text-cyan px-1.5 py-0.5 rounded text-xs">$1</code>');
}

function generateMockResponse(query: string): { content: string; cards?: any[] } {
  const lower = query.toLowerCase();

  if (lower.includes('payment') || lower.includes('confirm')) {
    return {
      content: "Here are the **3 orders** awaiting payment confirmation:\n\n1. **Rahul Sharma** — 2000kg 7-Ply 27\" 150 GSM · ₹1,64,000\n2. **Priya Patel** — 1000kg 5-Ply 36\" 120 GSM · ₹83,500\n3. **Amit Singh** — 500kg 3-Ply 30\" 150 GSM · ₹41,000\n\nWould you like me to **confirm all payments** or handle them individually?"
    };
  }

  if (lower.includes('capacity') || lower.includes('production')) {
    return {
      content: "**June 2026 Production Capacity**\n\n🏭 **67% utilized** — 135T booked of 202T total\n📅 **July**: Only 23% booked (46T of 202T)\n\nNext available slot: **June 18** onwards\nDelivery estimate: **7-10 working days**\n\nWant me to check capacity for a specific order size?"
    };
  }

  if (lower.includes('customer') || lower.includes('find') || lower.includes('search')) {
    return {
      content: "Found **Nikhil's** recent conversation:\n\n📱 **Nikhil** (+91 94552 81616)\n💬 Last message: \"I don't know please give me all menu and price also\"\n🤖 AI replied: Holding for your input\n⏳ Stage: **greeting** — needs escalation response\n\nYou can **reply inline** or **dismiss** this escalation."
    };
  }

  if (lower.includes('quote') || lower.includes('create')) {
    return {
      content: "✅ **Quote Generated**\n\n📋 36\" · 3.5g · Silver · Regular Lam · 800kg\n💰 **₹82.50/kg** = **₹66,000 total** (ex-factory, GST extra)\n\nBreakdown:\n• Base (3.0g): ₹80/kg\n• Size premium (36\"): +₹1.50/kg\n• Lamination (Regular): +₹6/kg\n• Grammage adjustment: -₹5/kg\n\nShall I send this to the customer?"
    };
  }

  return {
    content: `I analyzed your request: \`${query}\`\n\nHere's what I can help with:\n\n🔍 **Search** — Find customers, orders, conversations\n📊 **Analytics** — Revenue, production, pipeline data\n📝 **Create** — Quotes, orders, customer records\n💬 **Respond** — Answer pending escalations\n📅 **Check** — Production capacity, delivery estimates\n\nJust type what you need in natural language.`
  };
}

