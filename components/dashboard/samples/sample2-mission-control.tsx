'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Search, Bot, Brain, Zap, ChartNoAxesCombined,
  MessageCircle, Factory, BadgeIndianRupee, MessageSquareText, Phone,
  ChevronLeft, ChevronRight, BadgeCheck, AlertTriangle,
  CircleDot, Clock3, Gauge, Activity, Database, BookOpen,
  RefreshCw, Mic, Paperclip, X, Bell, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ─── Sample 2: "Mission Control" — 3-Column Cockpit ─────────────────
   Design philosophy: Split workspace like a pilot's cockpit. Left = customer
   chat list (incoming). Center = AI-powered workspace with embedded data.
   Right = intelligence panel (metrics, memory, activity). Everything visible
   simultaneously. No tab switching. Power user layout.
   ─────────────────────────────────────────────────────────────────── */

interface ChatPreview {
  id: string; name: string; phone: string; lastMsg: string; time: string;
  unread: number; stage: string; aiActive: boolean;
}

export function MissionControl() {
  const [activePanel, setActivePanel] = useState<'all' | 'center-only' | 'right-only'>('all');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{role: string; content: string}>>([
    { role: 'assistant', content: "👋 I'm monitoring all customer conversations. 12 active chats, 3 need your attention. Ask me anything or click a chat to jump in." }
  ]);

  const chats: ChatPreview[] = [
    { id: '1', name: 'Nikhil', phone: '+91 94552 81616', lastMsg: 'Please give me all menu and price', time: '2m ago', unread: 2, stage: 'greeting', aiActive: true },
    { id: '2', name: 'Rahul Sharma', phone: '+91 98765 43210', lastMsg: '36 inch 3.5g silver order confirm', time: '5m ago', unread: 0, stage: 'order_confirmed', aiActive: true },
    { id: '3', name: 'Priya Patel', phone: '+91 99887 76655', lastMsg: 'Delivery kab tak hoga?', time: '15m ago', unread: 1, stage: 'in_production', aiActive: true },
    { id: '4', name: 'Amit Singh', phone: '+91 98123 45678', lastMsg: 'GST number bhej raha hoon', time: '1h ago', unread: 0, stage: 'collecting_logistics', aiActive: false },
    { id: '5', name: 'Suresh Kumar', phone: '+91 88776 65544', lastMsg: 'White lamination possible?', time: '2h ago', unread: 0, stage: 'collecting_specs', aiActive: true },
  ];

  const kpiQuick = [
    { label: 'Revenue Today', value: '₹45.2K', icon: BadgeIndianRupee, tone: 'cyan' },
    { label: 'Active', value: '12', icon: MessageCircle, tone: 'violet' },
    { label: 'Production', value: '67%', icon: Gauge, tone: 'green' },
    { label: 'Pipeline', value: '₹8.5L', icon: ChartNoAxesCombined, tone: 'amber' },
  ];

  const activityFeed = [
    { event: 'Order confirmed', detail: 'Rahul Sharma · 2000kg Gold', time: '5m ago', tone: 'green' },
    { event: 'Escalation pending', detail: 'Nikhil · Needs menu & pricing', time: '2m ago', tone: 'red' },
    { event: 'WhatsApp sent', detail: 'Priya · Delivery update', time: '15m ago', tone: 'cyan' },
    { event: 'GST collected', detail: 'Amit Singh · Logistics stage', time: '1h ago', tone: 'violet' },
    { event: 'Quote generated', detail: 'Suresh · 30" 4g Regular', time: '2h ago', tone: 'amber' },
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* ── COLUMN 1: Customer Chat List ── */}
      <div className={cn(
        "glass-strong flex flex-col border-r border-white/10 transition-all duration-300",
        activePanel === 'center-only' ? 'w-0 overflow-hidden opacity-0' : 'w-[300px] shrink-0'
      )}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Customer Chats</h2>
            <Badge tone="green">12 Live</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              placeholder="Search chats..."
              className="w-full h-9 rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-xs outline-none focus:border-cyan/40 text-white placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat.id === selectedChat ? null : chat.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-white/[0.05] transition hover:bg-white/[0.04]",
                selectedChat === chat.id && "bg-cyan/10 border-l-2 border-l-cyan"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 to-violet/20 text-xs font-semibold text-white">
                      {chat.name.slice(0, 2).toUpperCase()}
                    </div>
                    {chat.aiActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-cyan border-2 border-void animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{chat.name}</span>
                      {chat.unread > 0 && (
                        <span className="shrink-0 h-5 w-5 rounded-full bg-cyan text-[10px] font-bold text-black flex items-center justify-center">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{chat.lastMsg}</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">{chat.time}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── COLUMN 2: AI Workspace Center ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Quick KPI Strip */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setActivePanel(activePanel === 'all' ? 'center-only' : 'all')}
            className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white"
          >
            {activePanel === 'all' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {kpiQuick.map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <kpi.icon className={cn("h-3.5 w-3.5",
                kpi.tone === 'cyan' ? 'text-cyan' : kpi.tone === 'violet' ? 'text-violet-300' : kpi.tone === 'green' ? 'text-emerald-400' : 'text-amber-300'
              )} />
              <span className="text-xs text-slate-400">{kpi.label}</span>
              <span className="text-sm font-semibold text-white">{kpi.value}</span>
            </div>
          ))}
          <button
            onClick={() => setActivePanel(activePanel === 'all' ? 'right-only' : 'all')}
            className="ml-auto p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white"
          >
            {activePanel === 'all' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Chat Detail or AI Workspace */}
        {selectedChat ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10">
              <button onClick={() => setSelectedChat(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 to-violet/20 text-xs font-semibold text-white">
                {chats.find(c => c.id === selectedChat)?.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{chats.find(c => c.id === selectedChat)?.name}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />{chats.find(c => c.id === selectedChat)?.phone}
                </div>
              </div>
              <Button size="sm" className="ml-auto text-xs">Reply via WhatsApp</Button>
            </div>
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <MessageSquareText className="mx-auto h-10 w-10 text-slate-700 mb-3" />
                <p>Chat messages load here</p>
                <p className="text-xs text-slate-600 mt-1">Connected via ChakraHQ WhatsApp</p>
              </div>
            </div>
          </div>
        ) : (
          /* AI Workspace */
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="glass rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10">
                  <Brain className="h-4 w-4 text-cyan" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">AI Mission Control</div>
                  <div className="text-xs text-slate-500">Query · Search · Execute</div>
                </div>
                <span className="ml-auto relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan" />
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 mt-1">
                        <Sparkles className="h-3.5 w-3.5 text-cyan" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6",
                      msg.role === 'user'
                        ? "rounded-tr-sm bg-gradient-to-br from-cyan/20 to-violet/15 border border-cyan/20 text-white"
                        : "rounded-tl-sm bg-white/[0.06] border border-white/10 text-slate-200"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && aiQuery.trim()) {
                        setAiMessages(prev => [...prev, { role: 'user', content: aiQuery }, { role: 'assistant', content: '🔍 Searching database... I found the information you need. Check the intelligence panel for results.' }]);
                        setAiQuery('');
                      }
                    }}
                    placeholder="Ask AI: 'Show pending payments', 'Check production capacity'..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 text-white px-2"
                  />
                  <Button size="icon" disabled={!aiQuery.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── COLUMN 3: Intelligence Panel ── */}
      <aside className={cn(
        "glass-strong flex flex-col border-l border-white/10 transition-all duration-300",
        activePanel === 'center-only' ? 'w-0 overflow-hidden opacity-0' : 'w-[320px] shrink-0'
      )}>
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">AI Intelligence</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live state · Activity · Memory</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live AI State */}
          <div className="rounded-xl border border-cyan/20 bg-cyan/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-cyan" />
              <span className="text-sm font-medium text-cyan">Live AI State</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Ravi Agent</span><span className="text-emerald-400">Active</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Auto Reply</span><span className="text-emerald-400">ON</span></div>
              <div className="flex justify-between"><span className="text-slate-400">ChakraHQ</span><span className="text-emerald-400">Connected</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Sarvam LLM</span><span className="text-emerald-400">Online</span></div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-medium text-white">Recent Activity</span>
            </div>
            <div className="space-y-2.5">
              {activityFeed.map((event, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                    event.tone === 'green' ? 'bg-emerald-400' :
                    event.tone === 'red' ? 'bg-red-400' :
                    event.tone === 'cyan' ? 'bg-cyan' : 'bg-violet-400'
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 truncate">{event.event}</p>
                    <p className="text-[11px] text-slate-500 truncate">{event.detail}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">{event.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Memory */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-medium text-white">AI Memory</span>
            </div>
            <div className="space-y-2">
              {['meter_weight:36:3.5:unlam → 148 g/m', 'company:name → Flowzint Interweave', 'rule:minimum_order → 500 kg', 'quality:gold:strength → 1800 N'].map((mem, i) => (
                <div key={i} className="text-xs text-slate-400 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
                  {mem}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

