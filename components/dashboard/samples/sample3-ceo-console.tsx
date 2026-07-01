'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Search, Bot, ChartNoAxesCombined, BadgeIndianRupee,
  MessageCircle, Factory, Gauge, Activity, Bell,
  ArrowUpRight, ArrowRight, ChevronRight,
  CircleDot, Clock3, Check, BadgeCheck,
  Send, MessageSquareText, Phone, Settings,
  AlertTriangle, ClipboardList, BookOpen, Zap,
  ShieldCheck, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ─── Sample 3: "CEO Console" — Data-Rich Executive View ────────────
   Design philosophy: Information-dense but beautifully organized. Top section
   has revenue & production KPIs with sparklines. Center is a bento grid of
   pipeline, orders, and capacity cards. AI assistant lives in a collapsible
   right drawer. Command+K palette for power users. Built for the CEO who
   wants everything visible without scrolling.
   ─────────────────────────────────────────────────────────────────── */

export function CEOConsole() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // Revenue data
  const revenueBars = [65, 78, 52, 91, 84, 72, 95];
  const maxRevenue = Math.max(...revenueBars);

  const priorityAlerts = [
    { type: 'escalation', text: 'Nikhil needs menu & pricing reply', time: '2m ago', urgent: true },
    { type: 'payment', text: 'Rahul Sharma — confirm ₹1.64L payment', time: '5m ago', urgent: true },
    { type: 'payment', text: 'Priya Patel — confirm ₹83.5K payment', time: '15m ago', urgent: false },
  ];

  const pipelineStages = [
    { stage: 'New', count: 12, color: 'bg-slate-500', pct: 22 },
    { stage: 'Specs', count: 8, color: 'bg-blue-500', pct: 15 },
    { stage: 'Quoting', count: 5, color: 'bg-amber-500', pct: 9 },
    { stage: 'Logistics', count: 6, color: 'bg-indigo-500', pct: 11 },
    { stage: 'Confirmed', count: 9, color: 'bg-emerald-500', pct: 17 },
    { stage: 'Production', count: 7, color: 'bg-violet-500', pct: 13 },
    { stage: 'Complete', count: 7, color: 'bg-cyan', pct: 13 },
  ];

  const topCards = [
    {
      title: 'Total Revenue',
      value: '₹12,45,800',
      change: '+18.2%',
      up: true,
      chart: revenueBars,
      chartColor: 'bg-cyan',
      icon: BadgeIndianRupee,
      iconTone: 'cyan',
    },
    {
      title: 'Active Customers',
      value: '54',
      change: '+7 this week',
      up: true,
      chart: [12, 19, 15, 22, 24, 20, 28],
      chartColor: 'bg-violet-500',
      icon: MessageCircle,
      iconTone: 'violet',
    },
    {
      title: 'Production Util.',
      value: '67%',
      change: '-3% vs last month',
      up: false,
      chart: [72, 68, 70, 65, 69, 67, 67],
      chartColor: 'bg-emerald-500',
      icon: Factory,
      iconTone: 'green',
    },
    {
      title: 'Avg. Order Value',
      value: '₹82,300',
      change: '+5.1%',
      up: true,
      chart: [71, 76, 79, 77, 83, 80, 82],
      chartColor: 'bg-amber-500',
      icon: ChartNoAxesCombined,
      iconTone: 'amber',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-ring" />
          <span className="text-sm font-medium text-white">CEO Console</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button className="relative p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white transition">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">3</span>
          </button>
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-400 hover:text-white hover:border-cyan/30 transition"
          >
            <Search className="h-3 w-3" />
            <span className="hidden sm:inline">Cmd+K</span>
          </button>
          <span className="text-xs text-slate-600">{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── Priority Alerts ── */}
        {priorityAlerts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {priorityAlerts.map((alert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "glass-strong rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-cyan/30 transition-all",
                  alert.urgent && "border-red-400/30 bg-red-400/5"
                )}
              >
                <span className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0",
                  alert.type === 'escalation' ? 'bg-red-400' : 'bg-amber-400'
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{alert.text}</p>
                  <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Top KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-strong rounded-xl p-5 group cursor-pointer hover:border-cyan/30 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500">{card.title}</span>
                <card.icon className={cn("h-4 w-4",
                  card.iconTone === 'cyan' ? 'text-cyan' :
                  card.iconTone === 'violet' ? 'text-violet-300' :
                  card.iconTone === 'green' ? 'text-emerald-400' : 'text-amber-300'
                )} />
              </div>
              <div className="text-2xl font-bold text-white mb-2">{card.value}</div>
              <div className="flex items-center gap-2">
                <span className={cn("flex items-center gap-1 text-xs", card.up ? 'text-emerald-400' : 'text-red-400')}>
                  {card.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                  {card.change}
                </span>
              </div>
              {/* Mini sparkline */}
              <div className="flex items-end gap-[2px] h-8 mt-3">
                {card.chart.map((val, j) => (
                  <div
                    key={j}
                    className={cn("flex-1 rounded-t-sm opacity-60 group-hover:opacity-100 transition-opacity", card.chartColor)}
                    style={{ height: `${(val / maxRevenue) * 100}%` }}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Bento Grid: Pipeline + Orders + Capacity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline Card (spans 2 col on xl) */}
          <div className="lg:col-span-2 glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Customer Pipeline</h3>
              <Badge tone="cyan">54 Total</Badge>
            </div>
            <div className="space-y-3">
              {pipelineStages.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-3 group">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{stage.stage}</span>
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden relative border border-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stage.pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={cn("h-full rounded-lg", stage.color, "opacity-60")}
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white">
                      {stage.count}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 w-10 shrink-0 text-right">{stage.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Production Gauge Card */}
          <div className="glass-strong rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Production</h3>
            <div className="flex flex-col items-center">
              {/* Donut Gauge */}
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#55e6ff" strokeWidth="12"
                    strokeDasharray={`${67 * 3.14} ${100 * 3.14}`}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(85,230,255,0.4)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">67%</span>
                  <span className="text-xs text-slate-500">utilized</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full text-center">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2">
                  <div className="text-lg font-bold text-white">135T</div>
                  <div className="text-[10px] text-slate-500">Booked</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2">
                  <div className="text-lg font-bold text-emerald-400">67T</div>
                  <div className="text-[10px] text-slate-500">Available</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Orders Table + Recent Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Orders</h3>
              <Badge tone="violet">3 pending payment</Badge>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Rahul Sharma', spec: '27" 3g Gold 2000kg', amount: '₹1,64,000', status: 'confirmed' },
                { name: 'Priya Patel', spec: '36" 3.5g Silver 1000kg', amount: '₹83,500', status: 'confirmed' },
                { name: 'Amit Singh', spec: '30" 4g Regular 500kg', amount: '₹41,000', status: 'in_production' },
                { name: 'Suresh Kumar', spec: '30" 4g Regular 800kg', amount: '₹65,600', status: 'completed' },
              ].map((order, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition cursor-pointer">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                    order.status === 'confirmed' ? 'bg-amber-400' :
                    order.status === 'in_production' ? 'bg-blue-400' : 'bg-emerald-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{order.name}</p>
                    <p className="text-xs text-slate-500 truncate">{order.spec}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">{order.amount}</p>
                    <p className="text-[10px] text-slate-500">{order.status.replace('_', ' ')}</p>
                  </div>
                  {order.status === 'confirmed' && (
                    <Button size="sm" className="text-[10px] h-7">Confirm</Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-strong rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Live Feed</h3>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
              </span>
            </div>
            <div className="space-y-3">
              {[
                { icon: MessageSquareText, text: 'Ravi replied to Nikhil', sub: 'Menu & pricing sent', time: 'just now', tone: 'cyan' },
                { icon: BadgeIndianRupee, text: 'Quote generated for Priya', sub: '₹83,500 · 36" Silver', time: '2m ago', tone: 'violet' },
                { icon: Factory, text: 'Production started: Order #8', sub: 'Amit Singh · 500kg Regular', time: '5m ago', tone: 'green' },
                { icon: AlertTriangle, text: 'Escalation: Nikhil needs help', sub: 'Requires owner input', time: '8m ago', tone: 'red' },
                { icon: BadgeCheck, text: 'Payment confirmed: Order #5', sub: 'Delivered · WhatsApp sent', time: '15m ago', tone: 'green' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    item.tone === 'cyan' ? 'bg-cyan/10 border border-cyan/20' :
                    item.tone === 'violet' ? 'bg-violet/10 border border-violet/20' :
                    item.tone === 'green' ? 'bg-emerald-400/10 border border-emerald-400/20' :
                    'bg-red-400/10 border border-red-400/20'
                  )}>
                    <item.icon className={cn("h-3.5 w-3.5",
                      item.tone === 'cyan' ? 'text-cyan' :
                      item.tone === 'violet' ? 'text-violet-300' :
                      item.tone === 'green' ? 'text-emerald-400' : 'text-red-400'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">{item.text}</p>
                    <p className="text-xs text-slate-500">{item.sub}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Assistant Drawer (Floating) ── */}
      <AnimatePresence>
        {aiDrawerOpen && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] glass-strong border-l border-white/10 z-20 flex flex-col"
          >
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 shadow-glow">
                <Bot className="h-4 w-4 text-cyan" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">AI Executive Assistant</div>
                <div className="text-xs text-slate-500">Powered by Sarvam + Database</div>
              </div>
              <button onClick={() => setAiDrawerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 p-4 text-sm text-slate-200">
                Hello! I'm your AI CEO assistant. I can query your database, search customers, create orders, and analyze your business. Try:
                <ul className="mt-3 space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan" /> "Show today's revenue breakdown"</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan" /> "Which orders need payment?"</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan" /> "Create a quote for 36 inch silver"</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-cyan" /> "What's our production schedule?"</li>
                </ul>
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-2 rounded-xl border border-cyan/20 bg-cyan/10 p-2">
                <input placeholder="Ask anything..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 text-white px-2" />
                <Button size="icon"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Floating AI button ── */}
      {!aiDrawerOpen && (
        <motion.button
          onClick={() => setAiDrawerOpen(true)}
          whileHover={{ scale: 1.05 }}
          className="fixed right-6 bottom-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan to-violet-500 shadow-glow flex items-center justify-center z-10"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </motion.button>
      )}

      {/* ── Command Palette Overlay ── */}
      <AnimatePresence>
        {commandOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 flex items-start justify-center pt-[20vh]"
            onClick={() => setCommandOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[550px] glass-strong rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                <Search className="h-4 w-4 text-cyan" />
                <input
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Type a command: 'Show revenue', 'Create quote', 'Find customer'..."
                  className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-slate-500"
                  autoFocus
                />
                <span className="text-[10px] text-slate-600 bg-white/[0.06] px-2 py-1 rounded">esc</span>
              </div>
              <div className="p-2">
                {[
                  { cmd: 'Show today\'s revenue', icon: BadgeIndianRupee, hotkey: '⌘R' },
                  { cmd: 'Pending payments', icon: BadgeCheck, hotkey: '⌘P' },
                  { cmd: 'Production capacity', icon: Factory, hotkey: '⌘C' },
                  { cmd: 'Customer pipeline', icon: MessageCircle, hotkey: '⌘U' },
                  { cmd: 'Create new quote', icon: Sparkles, hotkey: '⌘Q' },
                  { cmd: 'Open AI assistant', icon: Bot, hotkey: '⌘J' },
                ].map((item, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] text-left transition text-sm"
                  >
                    <item.icon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-slate-200">{item.cmd}</span>
                    <span className="text-[10px] text-slate-600 bg-white/[0.05] px-2 py-0.5 rounded">{item.hotkey}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


