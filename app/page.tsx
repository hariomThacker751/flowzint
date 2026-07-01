"use client";

import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bot,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Database,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Factory,
  FileText,
  Gauge,
  Languages,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  navItems,
  type ViewKey,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
// ── Operations sections (Phase 0–4 backend), folded into existing pages. ──
// Flag-gated: set NEXT_PUBLIC_OPS_UI=false to hide all and restore the original.
import { OPS_UI_ENABLED } from "@/lib/ops-ui";
// ── Vision OS shell (module-host evolution). Flag-gated, OFF by default. ──
// Set NEXT_PUBLIC_VISION_OS=true to render the grouped 5-area navigation.
import { VISION_OS_ENABLED } from "@/lib/vision-os/flag";
import { VisionSidebar } from "@/components/vision-os/vision-sidebar";
import { VisionHome } from "@/components/vision-os/vision-home";
import { CommandPalette } from "@/components/vision-os/command-palette";
import { VisionTopBar } from "@/components/vision-os/vision-top-bar";
import { ApprovalTray } from "@/components/vision-os/approval-tray";
import { VisionOrders } from "@/components/vision-os/vision-orders";
import { VisionProduction } from "@/components/vision-os/vision-production";
import { VisionConfig } from "@/components/vision-os/vision-config";
import OpsTemplates from "@/components/dashboard/ops/ops-templates";
import OpsApprovals from "@/components/dashboard/ops/ops-approvals";
import { DeliveryAnalytics, ProductionOps, CancellationsOps } from "@/components/dashboard/ops/ops-automation";
import { SidebarAccount } from "@/components/dashboard/ops/ops-shared";

// ── New modular dashboard components (additive, non-breaking) ──
import { KanbanPipeline } from "@/components/dashboard/kanban-pipeline";
import { ApprovalsQueue } from "@/components/dashboard/approvals-queue";
import { DailyEntryPanel } from "@/components/dashboard/daily-entry-panel";
import { DunningWidget } from "@/components/dashboard/dunning-widget";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10000,
    },
  },
});

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <SalesOS />
    </QueryClientProvider>
  );
}

/* ─── Types ─────────────────────────────────────────────────────── */
type AgentRuntimeResponse = {
  state: {
    agentEnabled: boolean;
    raviEnabled: boolean;
    outboundSalesEnabled: boolean;
    autoSendRaviReplies: boolean;
    tokenCancelDays: number;
    ownerPhone?: string;
    updatedAt: string;
  };
  config: {
    chakraConfigured: boolean;
    sarvamConfigured: boolean;
    ownerPhoneConfigured: boolean;
    webhookSecretConfigured: boolean;
    chakraApiVersion: string;
    sarvamModel: string;
  };
};

type LiveCustomer = {
  id: string;
  phone: string;
  name: string;
  company: string;
  gst_number: string;
  city: string;
  state: string;
  language: string;
  stage: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
};

type ChatMessage = {
  id: string;
  customer_id: string;
  channel: string;
  role: string;
  content: string;
  created_at: string;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  actor: string;
  customer_name: string;
  customer_company: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type StreamEventHandlers = {
  onDelta?: (content: string) => void;
  onDone?: (data: any) => void;
  onError?: (message: string) => void;
};

async function readEventStream(response: Response, handlers: StreamEventHandlers) {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming response did not include a body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of rawEvent.split(/\r?\n/)) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }

      if (dataLines.length === 0) continue;
      const payloadText = dataLines.join("\n");
      const payload = JSON.parse(payloadText);

      if (eventName === "delta") handlers.onDelta?.(String(payload.content || ""));
      if (eventName === "done") handlers.onDone?.(payload);
      if (eventName === "error") handlers.onError?.(String(payload.error || "Streaming failed"));
    }
  }
}

function visibleLLMText(content: string) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("The user ")) return content;

  const splitAt = trimmed.indexOf("\n\n");
  if (splitAt === -1) return content;

  return trimmed.slice(splitAt + 2).trimStart();
}

type KnowledgeEntry = {
  id: string;
  key: string;
  value: string;
  type: string;
  scope: string;
  source: string;
  created_at: string;
  updated_at: string;
};

type Quote = {
  id: string;
  customer_id: string;
  enquiry_id: string;
  base_price: number;
  unit_price: number;
  total_amount: number;
  owner_approved: number;
  size_inches: number;
  grammage: number;
  quality: string;
  color: string;
  lamination: string;
  quantity_kg: number;
  delivery_city: string;
  customer_name: string;
  customer_company: string;
  customer_phone: string;
  created_at: string;
};

type DashboardStats = {
  activeConversations: number;
  todayQuotesCount: number;
  todayQuotesAmount: number;
  pendingOwnerInputs: number;
  knowledgeNodes: number;
  corrugatorUtilization: number;
  availableCapacityKg: number;
  bookedKg: number;
  revenuePipeline: number;
  stages: Array<{ stage: string; count: number }>;
  sevenDayProduction: Array<{ day: string; booked: number; available: number; corrugator: number }>;
  chartData?: { sevenDayRevenue: Array<{ day: string; amount: number }> };
  paymentsPendingCount?: number;
  pendingEscalationsCount?: number;
  pendingEscalations?: any[];
  paymentsPending?: any[];
  allEnquiries?: any[];
  totalMonthlyCapacityKg?: number;
  totalCorrugators?: number;
  recentBookings?: Array<{ id: string; customerName: string; kgBooked: number; deliveryEstimateDays: number; status: string }>;
};

type OwnerTemplate = {
  id: string;
  name: string;
  language: string;
  body: string;
  category: string;
  updatedAt: string;
};

/* ─── Root App ─────────────────────────────────────────────────── */
function SalesOS() {
  const activeView = useUIStore((state) => state.activeView);
  const collapsed = useUIStore((state) => state.collapsed);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChakraChat | null>(null);

  function handleSelectChat(id: string, chat: ChakraChat) {
    setActiveChatId(id);
    setActiveChat(chat);
  }

  function handleCloseChat() {
    setActiveChatId(null);
    setActiveChat(null);
  }

  return (
    <main className="relative h-screen overflow-hidden bg-void text-slate-100">
      <AmbientLayer />
      <ApprovalModal />
      {VISION_OS_ENABLED && <CommandPalette />}
      {VISION_OS_ENABLED && <ApprovalTray />}
      <div className="relative z-10 flex h-full min-w-0">
        {VISION_OS_ENABLED ? <VisionSidebar /> : <Sidebar />}
        {(() => {
          const mainContent =
            activeView === "director" ? (
              <DirectorPage />
            ) : (
              <>
                {activeView === "chats" && (
                  <CustomerList
                    className={collapsed ? "hidden xl:flex" : "flex"}
                    activeChatId={activeChatId}
                    onSelectChat={handleSelectChat}
                  />
                )}
                <section className="flex min-w-0 flex-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeView === "chats" && activeChatId ? `chat-${activeChatId}` : activeView}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28 }}
                      className="min-w-0 flex-1 flex"
                    >
                      {activeView === "chats" && activeChatId ? (
                        <ChakraChatDetail
                          chatId={activeChatId}
                          chat={activeChat}
                          onClose={handleCloseChat}
                        />
                      ) : (
                        <MainView view={activeView} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </section>
              </>
            );

          // Vision OS: host the content under a shell top bar (reversible).
          if (!VISION_OS_ENABLED) return mainContent;
          return (
            <div className="flex min-w-0 flex-1 flex-col">
              <VisionTopBar />
              <div className="relative flex min-w-0 flex-1 overflow-hidden">{mainContent}</div>
            </div>
          );
        })()}
      </div>
    </main>
  );
}

function AmbientLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(85,230,255,0.16),transparent_28%),radial-gradient(circle_at_74%_18%,rgba(139,92,246,0.16),transparent_26%),radial-gradient(circle_at_72%_82%,rgba(56,239,125,0.09),transparent_24%)]" />
      <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-cyan/5 blur-3xl animate-slow-pan" />
      <div className="absolute right-8 top-10 h-72 w-72 rounded-full bg-violet/10 blur-3xl animate-slow-pan" />
      {Array.from({ length: 28 }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-cyan/30"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 19) % 100}%`,
          }}
          animate={{ opacity: [0.1, 0.9, 0.1], y: [0, -14, 0] }}
          transition={{ duration: 4 + (index % 5), repeat: Infinity, delay: index * 0.12 }}
        />
      ))}
    </div>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────── */
function Sidebar() {
  const activeView = useUIStore((state) => state.activeView);
  const collapsed = useUIStore((state) => state.collapsed);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const toggleCollapsed = useUIStore((state) => state.toggleCollapsed);

  const { data: statsData } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });

  // Live corrugator floor so the "Corrugator Floor" nav badge reflects real free count
  const { data: corrugatorNavData } = useQuery<{ ok: boolean; floor: { corrugators_available: number } }>({
    queryKey: ["corrugator-floor-nav"],
    queryFn: () => fetch("/api/corrugator").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const navBadges: Record<string, string> = {
    command: String((statsData?.stats?.paymentsPendingCount || 0) + (statsData?.stats?.pendingEscalationsCount || 0)) || "0",
    chats: statsData?.stats?.activeConversations?.toString() || "0",
    Director: statsData?.stats?.pendingOwnerInputs?.toString() || "0",
    quotes: statsData?.stats?.todayQuotesCount?.toString() || "0",
    payment: String(statsData?.stats?.paymentsPendingCount || 0),
    pricing: String(statsData?.stats?.corrugatorUtilization || 0) + "%",
    corrugator: `${corrugatorNavData?.floor?.corrugators_available ?? 45} free`,
    templates: "Chakra",
    knowledge: statsData?.stats?.knowledgeNodes?.toString() || "0",
    activity: "Live",
  };

  return (
    <aside
      className={cn(
        "glass-strong z-20 flex h-full shrink-0 flex-col border-r border-white/10 transition-all duration-300",
        collapsed ? "w-[86px]" : "w-[280px]",
      )}
    >
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <motion.div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 shadow-glow"
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Sparkles className="h-5 w-5 text-cyan" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" />
        </motion.div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xl font-semibold text-ai">Flowzint AI</div>
            <div className="text-xs text-slate-400">Autonomous Sales OS</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={toggleCollapsed} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Ravi + Auto-reply controls now live on the AI Command Center dashboard */}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.key;
          const badge = navBadges[item.key] || item.badge;
          return (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key as ViewKey)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-all",
                active
                  ? "border-cyan/30 bg-cyan/10 text-white shadow-glow"
                  : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-colors", active ? "text-cyan" : "text-slate-500 group-hover:text-cyan")} />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
              {!collapsed && badge && (
                <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-300">{badge}</span>
              )}
              {active && <motion.span layoutId="nav-glow" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan" />}
            </button>
          );
        })}
      </nav>
      {OPS_UI_ENABLED && <SidebarAccount collapsed={collapsed} />}
    </aside>
  );
}

/* ─── Ravi Control Panel (Command Center dashboard) ───────────── */
function RaviControlPanel() {
  const qc = useQueryClient();
  const { data, refetch, isFetching } = useQuery<AgentRuntimeResponse>({
    queryKey: ["agent-runtime-state"],
    queryFn: async () => {
      const response = await fetch("/api/agent/state");
      if (!response.ok) throw new Error("Failed to load agent state");
      return response.json();
    },
    refetchInterval: 8000,
  });

  async function toggle(key: keyof AgentRuntimeResponse["state"]) {
    if (!data) return;
    await fetch("/api/agent/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: !data.state[key] }),
    });
    await refetch();
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const state = data?.state;
  const config = data?.config;
  const raviOn = Boolean(state?.raviEnabled);
  const autoOn = Boolean(state?.autoSendRaviReplies);
  const agentOn = Boolean(state?.agentEnabled);
  const salesOn = Boolean(state?.outboundSalesEnabled);
  const configured = Boolean(config?.chakraConfigured && config?.sarvamConfigured);

  // The two primary toggles the owner asked for
  const primaryToggles: Array<{
    key: keyof AgentRuntimeResponse["state"];
    label: string;
    sub: string;
    on: boolean;
  }> = [
    {
      key: "raviEnabled",
      label: "Ravi",
      sub: raviOn ? "Online — replying to WhatsApp" : "Off — holding all replies",
      on: raviOn,
    },
    {
      key: "autoSendRaviReplies",
      label: "Auto-reply",
      sub: autoOn ? "Sending replies automatically" : "Drafts only — manual review",
      on: autoOn,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass scan-line relative overflow-hidden rounded-xl border border-white/10 p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
            raviOn ? "border-emerald-400/40 bg-emerald-400/10" : "border-slate-500/40 bg-slate-500/10"
          )}>
            <Bot className={cn("h-5 w-5", raviOn ? "text-emerald-300" : "text-slate-400")} />
            {raviOn && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Ravi Control</h3>
            <p className="text-xs text-slate-400">
              {raviOn ? (autoOn ? "Autonomous — replying & sending" : "Drafting — awaiting manual send") : "Paused"}
              {!configured && " · Needs env"}
            </p>
          </div>
        </div>
        <Badge tone={configured ? "green" : "amber"}>
          {configured ? "Configured" : "Needs env"}
        </Badge>
      </div>

      {/* Primary ON/OFF toggles */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {primaryToggles.map((t) => {
          const disabled = !state || isFetching;
          return (
            <button
              key={t.key}
              onClick={() => toggle(t.key)}
              disabled={disabled}
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                t.on
                  ? "border-emerald-400/40 bg-gradient-to-br from-emerald-400/15 to-emerald-400/[0.03] shadow-glow"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold transition-colors",
                  t.on ? "bg-emerald-400/20 text-emerald-200" : "bg-slate-600/20 text-slate-400",
                )}
              >
                {t.on ? "ON" : "OFF"}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-semibold", t.on ? "text-white" : "text-slate-300")}>{t.label}</div>
                <div className="truncate text-xs text-slate-400">{t.sub}</div>
              </div>
              {/* Switch visual */}
              <span className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                t.on ? "bg-emerald-400/80" : "bg-slate-600",
              )}>
                <span className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  t.on ? "translate-x-6" : "translate-x-1",
                )} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary runtime indicators */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { key: "agentEnabled" as const, label: "Agent core", on: agentOn },
          { key: "outboundSalesEnabled" as const, label: "Sales mode", on: salesOn },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => toggle(s.key)}
            disabled={!state || isFetching}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-60",
              s.on ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.on ? "bg-cyan" : "bg-slate-600")} />
            {s.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── ChakraHQ Chat Types ──────────────────────────────────────── */
type ChakraChat = {
  id: string;
  status: string;
  provider: string;
  primaryContact: { id: string; name: string; firstName?: string; lastName?: string; photo?: string } | null;
  primaryContactHandle: { value: string; type: string } | null;
  latestMessage: { text: string; direction: string; timestamp: number; dataType: string } | null;
  latestMessageTs: number;
  latestMessageDirection: string;
  startedAt: number;
  assignedTo: null | { name: string };
};

type ChakraMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  text: string;
  dataType: string;
  body: string;
  timestamp: number;
  createdAt: number;
  deliveryStatus: string;
  source: string | null;
};

/* ─── Customer List (Live from ChakraHQ) ──────────────────────── */
function CustomerList({
  className,
  activeChatId,
  onSelectChat,
}: {
  className?: string;
  activeChatId: string | null;
  onSelectChat: (id: string, chat: ChakraChat) => void;
}) {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<{
    ok: boolean;
    chats: ChakraChat[];
    total: number;
    error?: string;
    setupRequired?: boolean;
    missingKeys?: string[];
    help?: string;
  }>({
    queryKey: ["chakra-chats", search],
    queryFn: () => fetch(`/api/chakra/chats?limit=30${search ? `&search=${encodeURIComponent(search)}` : ""}`).then((r) => r.json()),
    refetchInterval: 8000,
  });

  const chats = data?.ok ? (data?.chats || []) : [];
  const apiError = (!isLoading && data?.ok === false) ? data?.error : null;
  const setupRequired = data?.setupRequired;
  const missingKeys = data?.missingKeys || [];

  function formatTime(ts: number) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }

  return (
    <section className={cn("glass-strong h-full w-[340px] shrink-0 flex-col border-r border-white/10", className)}>
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Customer Chats</h2>
            <p className="text-xs text-slate-500">ChakraHQ · {data?.total ?? 0} conversations</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white transition">
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </button>
            <Badge tone="green">Live</Badge>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="customer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-slate-100 outline-none transition focus:border-cyan/60"
            placeholder="Search name, phone..."
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan" />
          </div>
        )}
        {!isLoading && apiError && (
          <div className="m-3 rounded-xl border border-red-400/30 bg-red-400/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                {setupRequired ? (
                  <>
                    <p className="text-xs font-semibold text-red-300">API Keys Not Configured</p>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{apiError}</p>
                    {missingKeys.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {missingKeys.map((k) => (
                          <div key={k} className="rounded bg-black/30 px-2 py-1 font-mono text-[10px] text-amber-300">{k}=???</div>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-slate-500">Open <span className="font-mono text-cyan">.env.local</span> in the project folder and add your ChakraHQ keys, then restart the app.</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-red-300">ChakraHQ Error</p>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{apiError}</p>
                  </>
                )}
                <button onClick={() => refetch()} className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:text-white transition">
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !apiError && chats.length === 0 && (
          <div className="py-12 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" />
            <p className="text-sm text-slate-500">No chats yet</p>
            <p className="mt-1 text-xs text-slate-600">Chats appear when customers WhatsApp your business number</p>
          </div>
        )}
        {chats.map((chat) => {
          const active = chat.id === activeChatId;
          const contactName = chat.primaryContact?.name || chat.primaryContactHandle?.value || "Unknown";
          const phone = chat.primaryContactHandle?.value || "";
          const initials = contactName.slice(0, 2).toUpperCase();
          const lastMsg = chat.latestMessage?.text || "Media message";
          const isInbound = chat.latestMessageDirection === "INBOUND";
          return (
            <motion.button
              key={chat.id}
              onClick={() => onSelectChat(chat.id, chat)}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              className={cn(
                "flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left transition-all",
                active ? "bg-cyan/10 border-l-2 border-l-cyan" : "hover:bg-white/[0.03]",
              )}
            >
              <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 via-violet/20 to-emerald-400/20 text-sm font-semibold text-white">
                {initials}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink",
                  chat.status === "OPEN" ? "bg-emerald-400" : "bg-slate-500"
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">{contactName}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{formatTime(chat.latestMessageTs)}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{phone}</p>
                <p className={cn(
                  "mt-1.5 truncate text-xs",
                  isInbound ? "text-slate-300" : "text-slate-500"
                )}>
                  {!isInbound && <span className="mr-1 text-cyan">↩</span>}
                  {lastMsg}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}



/* ─── Main View Router ─────────────────────────────────────────── */
function MainView({ view }: { view: ViewKey }) {
  // ── Vision OS routing: unified area pages replace the fragmented legacy
  //    views. Reversible — flag off falls through to the originals below. ──
  if (VISION_OS_ENABLED) {
    if (view === "command") return <VisionHome />;
    if (["quotes", "payment", "dispatch", "trading", "cancelled"].includes(view)) return <VisionOrders />;
    if (["corrugator", "production"].includes(view)) return <VisionProduction />;
    if (view === "pricing") return <VisionConfig view={view}><PricingEnginePage /></VisionConfig>;
    if (view === "templates") return <VisionConfig view={view}><TemplatesPage /></VisionConfig>;
    if (view === "knowledge") return <VisionConfig view={view}><KnowledgeBasePage /></VisionConfig>;
    if (view === "seasonal") return <VisionConfig view={view}><SeasonalDemandPage /></VisionConfig>;
    if (view === "settings") return <VisionConfig view={view}><SettingsPage /></VisionConfig>;
  }
  if (view === "command") return <CommandCenter />;
  if (view === "quotes") return <QuotesPage />;
  if (view === "pricing") return <PricingEnginePage />;
  if (view === "templates") return <TemplatesPage />;
  if (view === "knowledge") return <KnowledgeBasePage />;
  if (view === "activity") return <ActivityPage />;
  if (view === "production") return <ProductionCenter />;
  if (view === "analytics") return <AnalyticsPage />;
  if (view === "settings") return <SettingsPage />;
  // v3 screens
  if (view === "corrugator") return <CorrugatorFloorPage />;
  if (view === "payment") return <PaymentGatePage />;
  if (view === "dispatch") return <DispatchSchedulePage />;
  if (view === "cancelled") return <CancelledOrdersPage />;
  if (view === "trading") return <TradingDeskPage />;
  if (view === "seasonal") return <SeasonalDemandPage />;
  return <ChatWorkspace />;
}

/* ─── ChakraHQ Chat Detail Panel (Full WhatsApp View) ─────────── */
function ChakraChatDetail({ chatId, chat, onClose }: { chatId: string; chat: ChakraChat | null; onClose: () => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "ok" | "err">("idle");
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ ok: boolean; messages: ChakraMessage[] }>({
    queryKey: ["chakra-messages", chatId],
    queryFn: () => fetch(`/api/chakra/messages?chatId=${chatId}&limit=60`).then((r) => r.json()),
    refetchInterval: 5000,
    enabled: Boolean(chatId),
  });



  const messages = (data?.messages || []).sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages.length]);

  async function sendReply() {
    if (!draft.trim() || sending) return;
    const phone = chat?.primaryContactHandle?.value || "";
    if (!phone) { setSendStatus("err"); return; }
    setSending(true);
    setSendStatus("idle");
    try {
      const res = await fetch("/api/chakra/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone.replace(/\D/g, ""), text: draft }),
      });
      const result = await res.json();
      if (result.ok) {
        setDraft("");
        setSendStatus("ok");
        setTimeout(() => { setSendStatus("idle"); refetch(); }, 2000);
      } else {
        setSendStatus("err");
      }
    } catch {
      setSendStatus("err");
    } finally {
      setSending(false);
    }
  }

  const contactName = chat?.primaryContact?.name || chat?.primaryContactHandle?.value || "Customer";
  const phone = chat?.primaryContactHandle?.value || "";

  function formatTs(ts: number) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="flex h-full flex-1 flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button onClick={onClose} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/30 to-violet/20 text-xs font-semibold text-white">
          {contactName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{contactName}</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Phone className="h-3 w-3" />{phone}
            <span className={cn("ml-1 h-2 w-2 rounded-full", chat?.status === "OPEN" ? "bg-emerald-400" : "bg-slate-500")} />
            {chat?.status}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AgentPill />
          <button onClick={() => refetch()} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <MessageCircle className="h-10 w-10 text-slate-700" />
            <p className="text-sm">No messages yet</p>
          </div>
        )}
        {messages.map((msg) => {
          const isInbound = msg.direction === "INBOUND";
          const isOutbound = msg.direction === "OUTBOUND";
          return (
            <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
              {isInbound && (
                <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/20 to-violet/20 text-xs font-semibold text-white">
                  {contactName.slice(0, 1)}
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6",
                isInbound
                  ? "rounded-tl-sm bg-white/[0.08] border border-white/10 text-slate-100"
                  : "rounded-tr-sm bg-gradient-to-br from-cyan/20 to-violet/15 border border-cyan/20 text-white shadow-glow"
              )}>
                <p>{msg.text || "[Media]"}</p>
                <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                  {formatTs(msg.timestamp || msg.createdAt)}
                  {isOutbound && <BadgeCheck className="h-3 w-3 text-cyan" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send bar */}
      <div className="border-t border-white/10 p-3">
        {sendStatus === "err" && (
          <div className="mb-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
            ❌ Send failed. Check ChakraHQ API key or 24h session window.
          </div>
        )}
        {sendStatus === "ok" && (
          <div className="mb-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
            ✅ Message sent via WhatsApp!
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-500"
            placeholder="Reply via WhatsApp (Enter to send)..."
          />
          <Button variant="ghost" size="icon"><Mic className="h-4 w-4" /></Button>
          <Button size="icon" onClick={sendReply} disabled={!draft.trim() || sending} aria-label="Send">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Chat Workspace (default view when no chat selected) ─────── */
function ChatWorkspace() {
  return (
    <section className="flex h-full items-center justify-center flex-col gap-6">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <MessageCircle className="h-20 w-20 text-slate-700" />
      </motion.div>
      <div className="text-center">
        <p className="text-lg font-medium text-slate-400">Select a chat from the left</p>
        <p className="mt-1 text-sm text-slate-600">All WhatsApp conversations from ChakraHQ appear there</p>
      </div>
    </section>
  );
}

function LiveMessageBubble({ message }: { message: ChatMessage }) {
  const isOwner = message.role === "owner";
  const isAI = message.role === "assistant";
  const isUser = message.role === "user";

  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
          {message.content} <span className="text-slate-600">{new Date(message.created_at).toLocaleTimeString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", (isAI || isOwner) ? "justify-start" : "justify-end")}>
      {(isAI || isOwner) && (
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          isAI ? "border-cyan/30 bg-cyan/10" : "border-violet/30 bg-violet/10"
        )}>
          {isAI ? <Bot className="h-4 w-4 text-cyan" /> : <Sparkles className="h-4 w-4 text-violet-200" />}
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl border px-4 py-3 text-sm leading-6",
          isAI ? "rounded-tl-sm border-cyan/25 bg-gradient-to-br from-cyan/12 to-violet/10 shadow-glow"
          : isOwner ? "rounded-tl-sm border-violet/30 bg-violet/10"
          : "rounded-tr-sm border-white/10 bg-white/[0.07]",
        )}
      >
        {isOwner && <div className="mb-1 text-[10px] font-semibold text-violet-300 uppercase">Owner note</div>}
        <p>{message.content}</p>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500">
          {new Date(message.created_at).toLocaleTimeString()}
          {isAI && <BadgeCheck className="h-3 w-3 text-cyan" />}
        </div>
      </div>
    </div>
  );
}

function AgentPill() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan" />
      </span>
      <span className="text-xs font-medium text-cyan">Ravi AI active</span>
    </div>
  );
}

/* ─── Command Center ───────────────────────────────────────────── */
function CommandCenter() {
  const { data: statsData, isLoading } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });

  // Live corrugator floor (digital twin) — free / external / maintenance counts
  const { data: corrugatorData } = useQuery<CorrugatorApiResponse>({
    queryKey: ["corrugator-floor"],
    queryFn: () => fetch("/api/corrugator").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const { data: activityData } = useQuery<{ ok: boolean; events: ActivityEvent[] }>({
    queryKey: ["activity-feed"],
    queryFn: () => fetch("/api/activity?limit=10").then((r) => r.json()),
    refetchInterval: 5000,
  });
  const qc = useQueryClient();

  const handleConfirmPayment = async (enquiryId: string) => {
    if (!confirm('Confirm advance payment received? Customer gets WhatsApp notification.')) return;
    try {
      const r = await fetch('/api/orders/confirm-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId }),
      });
      if (r.ok) { 
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        alert('✅ Payment confirmed & customer notified'); 
      }
      else alert('❌ Failed to confirm payment');
    } catch {
      alert('❌ Failed to confirm payment');
    }
  };

  const stats = statsData?.stats;

  const kpiCards = stats
    ? [
        { label: "Active Conversations", value: String(stats.activeConversations), delta: "Last 24h", color: "cyan", Icon: MessageCircle },
        { label: "Quotes Today", value: String(stats.todayQuotesCount), delta: `INR ${(stats.todayQuotesAmount / 100000).toFixed(1)}L`, color: "violet", Icon: FileText },
        { label: "Production Utilization", value: `${stats.corrugatorUtilization}%`, delta: "Today", color: "green", Icon: Factory },
        { label: "Revenue Pipeline", value: `INR ${(stats.revenuePipeline / 100000).toFixed(1)}L`, delta: "30 days", color: "amber", Icon: Database },
        { label: "Knowledge Nodes", value: String(stats.knowledgeNodes), delta: "Learned", color: "cyan", Icon: Brain },
        { label: "Pending Owner Inputs", value: String(stats.pendingOwnerInputs), delta: "Need reply", color: stats.pendingOwnerInputs > 0 ? "red" : "green", Icon: AlertTriangle },
      ]
    : [];

  let revenueChartData = stats?.chartData?.sevenDayRevenue || [];
  
  // Pad chart data to 7 days to prevent UI squeezing
  if (revenueChartData.length > 0 && revenueChartData.length < 7) {
    const padded = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const existing = revenueChartData.find((x: any) => x.day === dayStr);
      padded.push(existing || { day: dayStr, amount: 0 });
    }
    revenueChartData = padded;
  }

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="AI Command Center" subtitle="Owner-supervised autonomous WhatsApp sales workforce" />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan" />
        </div>
      ) : (
        <>
          {/* Ravi + Auto-reply controls — primary owner switches */}
          <RaviControlPanel />

          <div className="mt-6 grid gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {kpiCards.map((card, index) => {
              const Icon = card.Icon;
              const gradientText = 
                card.color === "cyan" ? "from-cyan to-blue-500" :
                card.color === "violet" ? "from-violet to-purple-600" :
                card.color === "green" ? "from-emerald-400 to-green-600" :
                card.color === "amber" ? "from-amber-400 to-orange-500" :
                "from-red-400 to-rose-600";
                
              const bgGlow = 
                card.color === "cyan" ? "bg-cyan/5" :
                card.color === "violet" ? "bg-violet/5" :
                card.color === "green" ? "bg-emerald-400/5" :
                card.color === "amber" ? "bg-amber-400/5" :
                "bg-red-400/5";

              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`glass scan-line relative overflow-hidden rounded-xl p-5 border-t border-white/10 group ${bgGlow}`}
                >
                  <Icon className={`absolute -right-4 -bottom-4 h-24 w-24 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-10 text-${card.color === 'amber' ? 'amber-400' : card.color === 'green' ? 'emerald-400' : card.color === 'violet' ? 'violet' : card.color === 'red' ? 'red-400' : 'cyan'}`} />
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 text-${card.color === 'amber' ? 'amber-400' : card.color === 'green' ? 'emerald-400' : card.color === 'violet' ? 'violet' : card.color === 'red' ? 'red-400' : 'cyan'}`} />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.label}</span>
                    </div>
                    <div className={`mt-3 text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br ${gradientText}`}>
                      {card.value}
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <Badge
                        tone={card.color === "red" ? "red" : card.color === "amber" ? "amber" : card.color === "green" ? "green" : card.color === "violet" ? "violet" : "cyan"}
                      >
                        {card.delta}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">

            {/* Left: Owner Action Inbox — now uses ApprovalsQueue component */}
            <ApprovalsQueue
              escalations={(stats?.pendingEscalations || []) as any[]}
              paymentsPending={(stats?.paymentsPending || []) as any[]}
              onConfirmPayment={handleConfirmPayment}
              onNavigateToDirector={(ctx) => {
                const store = useUIStore.getState();
                store.navigateToDirectorWithEscalation(ctx);
              }}
              totalCount={(stats?.paymentsPendingCount || 0) + (stats?.pendingEscalationsCount || 0)}
            />

            {/* Right: Corrugator Capacity + Production Engine */}
            <div className="glass rounded-xl p-6 border border-white/10 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-400/10 rounded-lg border border-emerald-400/20">
                    <Factory className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Production Engine</h3>
                    <p className="text-xs text-slate-400">{corrugatorData?.floor?.corrugators_available ?? stats?.totalCorrugators ?? 45} free of {corrugatorData?.floor?.total_corrugators ?? 45} corrugators · {(((corrugatorData?.floor?.corrugators_available ?? 45) * 150 * 30) / 1000).toFixed(0)}T live capacity</p>
                  </div>
                </div>
                <button
                  onClick={() => useUIStore.getState().setActiveView("corrugator")}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cyan hover:bg-cyan/10 transition"
                >
                  Manage Floor →
                </button>
              </div>

              {/* Visual Corrugator Grid — colored by live floor state (system/external/maintenance/free) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Corrugator Status (live)</span>
                  <div className="flex items-center gap-3 text-[10px] flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400/80" /> System {corrugatorData?.floor?.corrugators_in_system ?? 0}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet/70" /> External {corrugatorData?.floor?.corrugators_external ?? 0}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400/60" /> Maint {corrugatorData?.floor?.corrugators_maintenance ?? 0}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-700/50 border border-slate-700" /> Free {corrugatorData?.floor?.corrugators_available ?? 45}</span>
                  </div>
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
                  {Array.from({ length: corrugatorData?.floor?.total_corrugators ?? 45 }).map((_, i) => {
                    const inSys = corrugatorData?.floor?.corrugators_in_system ?? 0;
                    const ext = corrugatorData?.floor?.corrugators_external ?? 0;
                    const maint = corrugatorData?.floor?.corrugators_maintenance ?? 0;
                    let kind: "system" | "external" | "maintenance" | "free" = "free";
                    if (i < inSys) kind = "system";
                    else if (i < inSys + ext) kind = "external";
                    else if (i < inSys + ext + maint) kind = "maintenance";
                    const cls = {
                      system: "bg-emerald-400/80 shadow-sm shadow-emerald-400/30 animate-pulse",
                      external: "bg-violet/70",
                      maintenance: "bg-amber-400/60",
                      free: "bg-slate-700/50 border border-slate-700",
                    }[kind];
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm transition-all duration-500 ${cls}`}
                        title={`Corrugator ${i + 1}: ${kind}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Production stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-emerald-400">{((stats?.bookedKg || 0)/1000).toFixed(1)}T</div>
                  <div className="text-[10px] text-slate-500 uppercase">Booked</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-cyan">{((stats?.availableCapacityKg || 0)/1000).toFixed(0)}T</div>
                  <div className="text-[10px] text-slate-500 uppercase">Available</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                  <div className="text-lg font-bold text-amber-400">{stats?.paymentsPendingCount || 0}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Awaiting Pymt</div>
                </div>
              </div>

              {/* Active production batches */}
              <div className="flex-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Active Batches</span>
                <div className="mt-2 space-y-2 max-h-[140px] overflow-y-auto">
                  {(stats?.recentBookings || []).filter((b: any) => b.status === 'in_production').slice(0, 3).map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between bg-black/20 rounded-lg p-2 border border-white/5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-300 truncate">{b.customerName || 'Order'}</div>
                        <div className="text-[10px] text-slate-500">{b.kgBooked}kg · ~{b.deliveryEstimateDays || '?'}d delivery</div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                      </div>
                    </div>
                  ))}
                  {(!stats?.recentBookings || stats.recentBookings.filter((b: any) => b.status === 'in_production').length === 0) && (
                    <div className="text-[10px] text-slate-600 text-center py-3">No active batches</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <ChartPanel title="7-Day Revenue Trend (Live Quotes)">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38ef7d" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#38ef7d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => `₹${value / 100000}L`} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Area type="monotone" dataKey="amount" stroke="#38ef7d" fill="url(#revenue)" strokeWidth={2} name="Total Amount" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>

            {/* Orders Kanban Pipeline — replaces static 3-col grid */}
            <KanbanPipeline
              allEnquiries={(stats?.allEnquiries || []) as any[]}
              onConfirmPayment={handleConfirmPayment}
            />
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Director Page (Fully Functional) ────────────────────────────── */
function DirectorPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<Array<{ role: string; content: string; created_at: string }>>([]);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const escalationContext = useUIStore((state) => state.escalationContext);
  const clearEscalation = useUIStore((state) => state.setEscalationContext);
  // Get owner phone from agent state config, not hardcoded
  const { data: agentState } = useQuery<{ state: { ownerPhone?: string } }>({
    queryKey: ["agent-state"],
    queryFn: () => fetch("/api/agent/state").then(r => r.json()),
  });
  const ownerPhone = agentState?.state?.ownerPhone || "919924102678";

  const { data: DirectorData, refetch } = useQuery<{ ok: boolean; messages: Array<{ role: string; content: string; created_at: string }>; pendingEscalations: Array<{ id: string; question: string; customerName: string; customerPhone: string; createdAt: string }> }>({
    queryKey: ["Director-conversation"],
    queryFn: async () => {
      const r = await fetch(`/api/Director/chat?phone=${ownerPhone}`);
      return r.json();
    },
    refetchInterval: sending ? false : 5000,
  });

  const { data: knowledgeData, refetch: refetchKnowledge } = useQuery<{ ok: boolean; knowledge: KnowledgeEntry[] }>({
    queryKey: ["knowledge-all"],
    queryFn: () => fetch("/api/knowledge").then((r) => r.json()),
    refetchInterval: 10000,
  });

  const messages = DirectorData?.messages || [];
  const displayMessages = sending ? [...messages, ...streamingMessages] : messages;
  const knowledgeNodes = knowledgeData?.knowledge || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingMessages]);

  // Voice-to-text using Web Speech API — simplified & robust
  const [isListening, setIsListening] = useState(false);
  const listeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast("Voice not supported. Use Chrome or Edge.");
      return;
    }

    // If already listening, stop and commit text
    if (listeningRef.current) {
      listeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
      if (finalTranscriptRef.current.trim()) {
        setMessage((prev) => (prev + ' ' + finalTranscriptRef.current).trim());
        finalTranscriptRef.current = "";
      }
      return;
    }

    // Start listening
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        finalTranscriptRef.current = transcript;
        // Show in input as preview
        setMessage((prev) => {
          // Only update if we're showing voice preview
          return transcript;
        });
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setToast("Mic access denied. Allow microphone in browser settings and retry.");
        } else if (event.error !== 'no-speech') {
          setToast("Mic error: " + event.error);
        }
        listeningRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        listeningRef.current = false;
        setIsListening(false);
        // Commit final transcript
        if (finalTranscriptRef.current.trim()) {
          setMessage((prev) => (prev + ' ' + finalTranscriptRef.current).trim());
          finalTranscriptRef.current = "";
        }
      };

      recognitionRef.current = recognition;
      listeningRef.current = true;
      setIsListening(true);
      finalTranscriptRef.current = "";
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition:', err);
      setToast("Could not access microphone. Use Chrome and allow mic permissions.");
      listeningRef.current = false;
      setIsListening(false);
    }
  };

  // Document upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setToast("Reading document...");
    try {
      const text = await file.text();
      const preview = text.substring(0, 2000);
      setMessage((prev) =>
        prev + `\n\n[Uploaded: ${file.name}]\n${preview}${text.length > 2000 ? '\n...(truncated)' : ''}`
      );
      setToast(`Document loaded: ${file.name} (${(text.length/1024).toFixed(1)}KB)`);
    } catch {
      setToast("Could not read file. Try a .txt or .csv file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function sendToDirector() {
    if (!message.trim() || sending) return;
    const userText = message.trim();
    setSending(true);
    setMessage("");
    setToast(null);
    setStreamingMessages([
      { role: "user", content: userText, created_at: new Date().toISOString() },
      { role: "assistant", content: "", created_at: new Date().toISOString() },
    ]);
    try {
      const r = await fetch("/api/Director/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, phone: ownerPhone, stream: true }),
      });
      let finalResult: any = null;
      await readEventStream(r, {
        onDelta: (content) => {
          setStreamingMessages((current) => {
            if (current.length === 0) return current;
            const next = [...current];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + content };
            return next;
          });
        },
        onDone: (data) => {
          finalResult = data;
        },
        onError: (error) => {
          throw new Error(error);
        },
      });
      if (finalResult?.memoryExtracted) {
        setToast("✅ Director saved a new memory!");
        refetchKnowledge();
      } else if (finalResult?.escalationResolved) {
        setToast("✅ Escalation resolved! Ravi will now reply to the customer.");
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setStreamingMessages([]);
    } catch (error) {
      setToast("❌ Failed to send message to Director");
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function deleteKnowledge(id: string) {
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    refetchKnowledge();
  }

  return (
    <section className="flex h-full min-w-0 flex-1">
      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="glass-strong flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet/40 bg-violet/10 shadow-violet">
                <Brain className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Owner ↔ Director AI</h1>
                <p className="text-xs text-slate-500">Learning, quote approvals, production clarification, memory writes</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="green">Knowledge writer active</Badge>
          </div>
        </div>

        {/* Escalation Banner — shown when navigated from Owner Action Inbox */}
        {escalationContext && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-red-400/30 bg-red-400/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-300">Resolving: {escalationContext.customerName}</span>
                  <span className="text-xs text-slate-500">{escalationContext.customerPhone}</span>
                </div>
                <p className="text-sm text-slate-300 mb-3">Customer asked: "{escalationContext.question}"</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMessage(`Customer message: ${escalationContext.question}\n\nMy reply: `);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet/20 hover:bg-violet/30 text-violet-200 text-xs font-medium transition-colors border border-violet/30"
                  >
                    Draft Reply for Customer
                  </button>
                  <button
                    onClick={() => {
                      clearEscalation(null);
                      setToast("✅ Escalation cleared");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button onClick={() => clearEscalation(null)} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-5">
            {displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="mb-4 h-12 w-12 text-violet/40" />
                <h3 className="text-lg font-semibold text-white">Start Teaching Director</h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Teach Director about your business - prices, stock, delivery times, your communication style.
                  Director will learn and guide Ravi to talk exactly like you.
                </p>
                <div className="mt-6 grid gap-2 w-full max-w-md">
                  {[
                    "Meter weight for 36 inch 3.5g unlam is 148 g/m",
                    "I talk casually in Hindi-English mix. I say 'Haan bhai' a lot.",
                    "Minimum order is 500 kg for all sizes",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setMessage(suggestion)}
                      className="rounded-lg border border-violet/25 bg-violet/10 px-4 py-2 text-sm text-violet-200 hover:bg-violet/20 transition text-left"
                    >
                      "{suggestion}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              displayMessages.map((msg, index) => (
                <div key={index} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet/30 bg-violet/10 mr-3">
                      <Brain className="h-4 w-4 text-violet-200" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl border px-4 py-3 text-sm leading-6",
                      msg.role === "user"
                        ? "rounded-tr-sm border-white/10 bg-white/[0.07]"
                        : "rounded-tl-sm border-violet/30 bg-gradient-to-br from-violet/15 to-cyan/10 shadow-violet",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.role === "assistant" ? visibleLLMText(msg.content) : msg.content}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
            {toast}
          </div>
        )}

        <div className="glass-strong border-t border-white/10 p-4">
          <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-xl border border-violet/25 bg-violet/10 p-2">
            {/* Voice input button */}
            <button
              onClick={startVoiceInput}
              disabled={sending}
              className={`shrink-0 p-2 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-500/30 text-red-400 border border-red-500/50 animate-pulse'
                  : 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 border border-violet-500/20'
              }`}
              title="Voice input (Mic)"
            >
              <Mic className="h-4 w-4" />
            </button>
            {/* Document upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.md,.json,.log"
              onChange={handleFileUpload}
              className="hidden"
              id="Director-file-upload"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="shrink-0 p-2 rounded-lg bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 border border-violet-500/20 transition-colors"
              title="Upload document (.txt, .csv, .md)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              id="Director-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendToDirector();
                }
              }}
              disabled={sending}
              readOnly={isListening}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-500 disabled:opacity-50"
              placeholder={isListening ? "Listening... speak now" : "Ask Director anything, or upload a document..."}
            />
            <Button onClick={sendToDirector} disabled={!message.trim() || sending}>
              {sending ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Sparkles className="h-4 w-4" />
                </motion.div>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to Director
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right: memory events */}
      <aside className="glass-strong hidden w-[360px] shrink-0 border-l border-white/10 p-5 xl:flex xl:flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">AI Memory</h2>
            <p className="mt-1 text-xs text-slate-500">Customer-visible vs internal-only data.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetchKnowledge()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {knowledgeNodes.length === 0 && (
            <div className="py-8 text-center">
              <Database className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No memory yet</p>
              <p className="mt-1 text-xs text-slate-600">Start teaching Director!</p>
            </div>
          )}
          {knowledgeNodes.map((node) => (
            <div key={node.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-xs font-semibold text-white">{node.key}</div>
                  <div className="mt-1 text-xs text-slate-400">{node.value}</div>
                </div>
                <button
                  onClick={() => deleteKnowledge(node.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Badge tone={node.scope === "customer_visible" ? "green" : "amber"}>{node.scope}</Badge>
                <Badge tone="slate">{node.type}</Badge>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

/* ─── Knowledge Base Page ──────────────────────────────────────── */
function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("fact");
  const [newScope, setNewScope] = useState("customer_visible");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, refetch, isLoading } = useQuery<{ ok: boolean; knowledge: KnowledgeEntry[] }>({
    queryKey: ["knowledge-all-page", search],
    queryFn: () => fetch(`/api/knowledge${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((r) => r.json()),
    refetchInterval: 15000,
  });

  const knowledge = data?.knowledge || [];

  async function addKnowledge() {
    if (!newKey || !newValue) return;
    setSaving(true);
    try {
      const r = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, value: newValue, type: newType, scope: newScope, source: "owner" }),
      });
      const result = await r.json();
      if (result.ok) {
        setStatus("Memory saved!");
        setNewKey(""); setNewValue("");
        setShowAdd(false);
        refetch();
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      } else {
        setStatus(`Error: ${result.error}`);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(""), 3000);
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    refetch();
  }

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Knowledge Base" subtitle="AI memory graph for rules, facts, meter weights, billing terms, and production policies" />
      <div className="mb-5 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <Search className="h-4 w-4 text-cyan" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            placeholder="Search memory nodes..."
          />
          <Badge tone="cyan">{knowledge.length} nodes</Badge>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" />
          Add Memory
        </Button>
      </div>

      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mb-5 rounded-xl p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-white">Add Memory Node</h3>
          <div className="grid gap-3">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key (e.g., meter_weight:36:3.5:unlam)"
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-cyan/50"
            />
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value (e.g., 148 g/m)"
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-cyan/50"
            />
            <div className="flex gap-3">
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none flex-1">
                {["fact", "rule", "table", "template"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={newScope} onChange={(e) => setNewScope(e.target.value)} className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none flex-1">
                {["customer_visible", "internal_only"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <Button onClick={addKnowledge} disabled={!newKey || !newValue || saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Memory
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}><X className="h-4 w-4" />Cancel</Button>
            </div>
          </div>
          {status && <div className="mt-3 text-sm text-cyan">{status}</div>}
        </motion.div>
      )}

      {isLoading && <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {knowledge.map((node) => (
          <motion.div key={node.id} whileHover={{ y: -2 }} className="glass rounded-xl p-5 group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-semibold text-white">{node.key}</h3>
                <p className="mt-2 text-sm text-slate-300">{node.value}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/10">
                  <Database className="h-5 w-5 text-cyan" />
                </div>
                <button
                  onClick={() => deleteEntry(node.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="violet">{node.type}</Badge>
              <Badge tone={node.scope === "customer_visible" ? "green" : "amber"}>{node.scope}</Badge>
              <Badge tone="slate">{node.source}</Badge>
            </div>
          </motion.div>
        ))}
        {knowledge.length === 0 && !isLoading && (
          <div className="col-span-2 py-16 text-center">
            <Database className="mx-auto mb-4 h-12 w-12 text-slate-700" />
            <p className="text-slate-500">No knowledge entries yet</p>
            <p className="mt-1 text-sm text-slate-600">Teach Director via the Director AI tab, or add manually above.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Production Page ──────────────────────────────────────────── */
function ProductionPage() {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const { data: capData, isLoading } = useQuery<{ ok: boolean; capacity: any[] }>({
    queryKey: ["capacity-7day"],
    queryFn: () => fetch(`/api/capacity?startDate=${today}&endDate=${sevenDaysLater}`).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const { data: statsData } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const stats = statsData?.stats;
  const capacityByDay = useMemo(() => {
    if (!capData?.capacity) return [];
    const grouped: Record<string, { booked: number; available: number; planned: number }> = {};
    for (const row of capData.capacity as any[]) {
      if (!grouped[row.date]) grouped[row.date] = { booked: 0, available: 0, planned: 0 };
      grouped[row.date].booked += row.booked_kg;
      grouped[row.date].available += row.available_kg;
      grouped[row.date].planned += row.planned_kg;
    }
    return Object.entries(grouped).map(([date, data]) => ({
      day: new Date(date).toLocaleDateString("en-IN", { weekday: "short" }),
      booked: Math.round(data.booked / 1000 * 10) / 10,
      available: Math.round(data.available / 1000 * 10) / 10,
    }));
  }, [capData]);

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Production Capacity" subtitle="Delivery promises must come from production capacity rows, never model text" />
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["Corrugator utilization", `${stats?.corrugatorUtilization ?? 0}%`, Gauge],
          ["Booked today", `${((stats?.bookedKg ?? 0) / 1000).toFixed(1)}T`, Factory],
          ["Available capacity", `${((stats?.availableCapacityKg ?? 0) / 1000).toFixed(1)}T`, Check],
          ["Delivery risk", stats?.corrugatorUtilization && stats.corrugatorUtilization > 85 ? "High" : "Medium", AlertTriangle],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="glass rounded-xl p-5">
            <Icon className="h-5 w-5 text-cyan" />
            <div className="mt-4 text-2xl font-semibold text-white">{value as string}</div>
            <div className="text-xs text-slate-500">{label as string}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel title="Seven-Day Load Forecast">
          {isLoading ? (
            <div className="flex h-[320px] items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-cyan" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={capacityByDay}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="booked" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Booked T" />
                <Bar dataKey="available" fill="#38ef7d" radius={[6, 6, 0, 0]} name="Available T" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Factory Heatmap</h3>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "aspect-square rounded-md border border-white/10",
                  index % 9 === 0 ? "bg-red-400/40" : index % 5 === 0 ? "bg-amber-300/40" : index % 3 === 0 ? "bg-cyan/30" : "bg-emerald-400/30",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing Engine Page ──────────────────────────────────────── */
function PricingEnginePage() {
  const [sizeInches, setSizeInches] = useState(36);
  const [grammage, setGrammage] = useState(3.5);
  const [quality, setQuality] = useState("5-Ply");
  const [color, setColor] = useState("Plain");
  const [lamination, setLamination] = useState("None");
  const [quantity, setQuantity] = useState(1000);
  const [livePrice, setLivePrice] = useState<{ unit: number; total: number; breakdown: any } | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [basePrice, setBasePrice] = useState(80);
  const [savingBase, setSavingBase] = useState(false);
  const [priceStatus, setPriceStatus] = useState("");
  const qc = useQueryClient();

  const { data: priceConfigData } = useQuery<{ ok: boolean; config: { base_price_3g: number } }>({
    queryKey: ["price-config"],
    queryFn: () => fetch("/api/pricing/config").then((r) => r.json()),
  });

  useEffect(() => {
    if (priceConfigData?.config?.base_price_3g) {
      setBasePrice(priceConfigData.config.base_price_3g);
    }
  }, [priceConfigData]);

  async function calculateLivePrice() {
    setCalculatingPrice(true);
    try {
      const r = await fetch("/api/pricing/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeInches, grammage, quality, color, lamination, quantityKg: quantity }),
      });
      const data = await r.json();
      if (data.ok) {
        setLivePrice({
          unit: data.pricing.unitPrice,
          total: data.pricing.totalAmount,
          breakdown: data.pricing,
        });
      }
    } finally {
      setCalculatingPrice(false);
    }
  }

  async function saveBasePrice() {
    setSavingBase(true);
    try {
      const r = await fetch("/api/pricing/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePrice3g: basePrice, createdBy: "owner", notes: "Updated from dashboard" }),
      });
      const data = await r.json();
      setPriceStatus(data.ok ? "✅ Base price saved!" : `❌ ${data.error}`);
      qc.invalidateQueries({ queryKey: ["price-config"] });
    } finally {
      setSavingBase(false);
      setTimeout(() => setPriceStatus(""), 3000);
    }
  }

  const priceData = [
    { name: "3-Ply", price: Math.round(basePrice * 0.4 * 100) / 100 },
    { name: "5-Ply", price: Math.round(basePrice * 0.563 * 100) / 100 },
    { name: "7-Ply", price: Math.round(basePrice * 0.75 * 100) / 100 },
  ];

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Pricing Engine" subtitle="Deterministic ₹/box calculator. AI never invents prices." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {/* Base Price Control */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Set Today&apos;s Kraft Paper Base Price</h3>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-cyan/50 w-32"
                min={50}
                max={200}
              />
              <span className="text-sm text-slate-400">INR / unit (raw paper)</span>
              <Button onClick={saveBasePrice} disabled={savingBase}>
                {savingBase ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </Button>
            </div>
            {priceStatus && <p className="mt-2 text-sm text-cyan">{priceStatus}</p>}
          </div>

          {/* Quote Simulator */}
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">Live Quote Simulator</h3>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Box Size (inches, combined)</label>
                  <select value={sizeInches} onChange={(e) => setSizeInches(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none">
                    {[10, 15, 20, 24, 30, 36, 40, 45, 50, 55, 60].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Paper GSM</label>
                  <select value={grammage} onChange={(e) => setGrammage(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none">
                    {[120, 150, 200].map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ply Grade</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none">
                    {["3-Ply", "5-Ply", "7-Ply"].map((q) => <option key={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Finish / Printing</label>
                  <select value={lamination} onChange={(e) => setLamination(e.target.value)} className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none">
                    {["None", "Regular Lamination", "UV Coating"].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Quantity: {quantity} boxes</label>
                <input
                  type="range" min={100} max={5000} step={100} value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full accent-cyan"
                />
              </div>

              <Button className="w-full" onClick={calculateLivePrice} disabled={calculatingPrice}>
                {calculatingPrice ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                Calculate Price from Backend
              </Button>

              {livePrice && (
                <div className="rounded-xl border border-cyan/25 bg-cyan/10 p-4">
                  <div className="text-xs text-cyan">Computed backend quote</div>
                  <div className="mt-2 text-3xl font-semibold text-white">₹{livePrice.unit}/box</div>
                  <div className="text-sm text-slate-400">Total ₹{livePrice.total.toLocaleString("en-IN")} for {quantity} boxes</div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <div>Base: ₹{livePrice.breakdown.basePrice} | Size: +₹{livePrice.breakdown.sizePremium}</div>
                    <div>Grammage: ₹{livePrice.breakdown.grammageAdjustment} | Lam: +₹{livePrice.breakdown.laminationPremium}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <ChartPanel title="Box Price by Ply Grade">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="price" stroke="#55e6ff" strokeWidth={3} dot={{ fill: "#55e6ff" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </section>
  );
}

/* ─── Templates Page ───────────────────────────────────────────── */
function TemplatesPage() {
  const [templateName, setTemplateName] = useState("Flowzint_box_intro_en");
  const [language, setLanguage] = useState("en");
  const [body, setBody] = useState("Hello {{1}}, this is Ravi AI from Flowzint. We manufacture Corrugated Boxes — 3-Ply, 5-Ply, 7-Ply — custom size, GSM, and printing. Reply with your box requirement.");
  const [phone, setPhone] = useState("919408724777");
  const [salesText, setSalesText] = useState("Hello, this is Ravi AI from Flowzint. Please share your box size (L×W×H), ply grade (3/5/7-ply), GSM, printing, and quantity requirement.");
  const [testText, setTestText] = useState("Customer asks: 5-ply corrugated box, 30 inch size, 150 GSM, flexo printed, need 2000 boxes, Mumbai. Give quote.");
  const [raviDraft, setRaviDraft] = useState("");
  const [testingRavi, setTestingRavi] = useState(false);
  const [status, setStatus] = useState("");
  const [chakraTemplates, setChakraTemplates] = useState<any[]>([]);

  const ownerTemplates = useQuery<{ templates: OwnerTemplate[] }>({
    queryKey: ["owner-templates"],
    queryFn: async () => {
      const r = await fetch("/api/templates");
      if (!r.ok) throw new Error("Failed to load owner templates");
      return r.json();
    },
  });

  const runtime = useQuery<AgentRuntimeResponse>({
    queryKey: ["agent-runtime-state"],
    queryFn: async () => {
      const r = await fetch("/api/agent/state");
      if (!r.ok) throw new Error("Failed to load agent state");
      return r.json();
    },
    refetchInterval: 8000,
  });

  function setStatusMsg(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(""), 5000);
  }

  async function saveLocalTemplate() {
    setStatusMsg("Saving owner template...");
    const r = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, language, category: "UTILITY", body }),
    });
    const data = await r.json();
    setStatusMsg(data.ok ? "Owner template saved for future Ravi/Director use." : `Template save error: ${data.error}`);
    await ownerTemplates.refetch();
  }

  function useLocalTemplate(template: OwnerTemplate) {
    setTemplateName(template.name);
    setLanguage(template.language);
    setBody(template.body);
    setSalesText(template.body);
    setStatusMsg(`Loaded owner template: ${template.name}`);
  }

  async function createChakraTemplate() {
    setStatusMsg("Creating template in ChakraHQ...");
    const r = await fetch("/api/chakra/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, language, category: "UTILITY", body }),
    });
    const data = await r.json();
    setStatusMsg(data.ok ? "Template submitted to ChakraHQ for approval." : `Template error: ${data.error}`);
  }

  async function loadTemplates() {
    setStatusMsg("Loading ChakraHQ templates...");
    const r = await fetch("/api/chakra/templates");
    const data = await r.json();
    const list = Array.isArray(data?.result?.data) ? data.result.data : Array.isArray(data?.result) ? data.result : [];
    setChakraTemplates(list);
    setStatusMsg(data.ok ? `Loaded ${list.length} templates.` : `Template list error: ${data.error}`);
  }

  async function sendSalesMessage() {
    setStatusMsg("Sending sales WhatsApp message...");
    const r = await fetch("/api/chakra/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, text: salesText, mode: "sales" }),
    });
    const data = await r.json();
    setStatusMsg(data.ok ? "Sales message sent through ChakraHQ." : `Send error: ${data.error}`);
  }

  async function testRavi() {
    setTestingRavi(true);
    setRaviDraft("");
    setStatus("Streaming Ravi draft...");
    try {
      const r = await fetch("/api/sarvam/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "ravi", text: testText, stream: true }),
      });

      await readEventStream(r, {
        onDelta: (content) => setRaviDraft((current) => current + content),
        onDone: () => setStatusMsg("Ravi draft generated."),
        onError: (error) => {
          throw new Error(error);
        },
      });
    } catch (error) {
      setStatusMsg(error instanceof Error ? `Sarvam error: ${error.message}` : "Sarvam error");
    } finally {
      setTestingRavi(false);
    }
  }

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Templates + Agent Actions" subtitle="Create ChakraHQ templates, test Sarvam/Ravi, and send owner-approved sales messages" />
      {OPS_UI_ENABLED && <OpsTemplates />}
      <div className="mb-5 grid gap-3 lg:grid-cols-4">
        <RuntimeTile label="ChakraHQ" enabled={Boolean(runtime.data?.config.chakraConfigured)} detail={runtime.data?.config.chakraApiVersion ?? "v22.0"} />
        <RuntimeTile label="Sarvam" enabled={Boolean(runtime.data?.config.sarvamConfigured)} detail={runtime.data?.config.sarvamModel ?? "sarvam-105b"} />
        <RuntimeTile label="Ravi" enabled={Boolean(runtime.data?.state.raviEnabled)} detail={runtime.data?.state.autoSendRaviReplies ? "Auto-send on" : "Draft only"} />
        <RuntimeTile label="Sales Send" enabled={Boolean(runtime.data?.state.outboundSalesEnabled)} detail="Manual outbound" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Owner Template Builder</h3>
          <div className="mt-4 grid gap-3">
            <input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none focus:border-cyan/50" placeholder="template_name" />
            <select id="template-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-white/10 bg-ink px-3 py-3 text-sm outline-none focus:border-cyan/50">
              {["en", "hi", "gu", "ta", "te", "kn", "ml"].map((code) => <option key={code}>{code}</option>)}
            </select>
            <textarea id="template-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 outline-none focus:border-cyan/50" />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={saveLocalTemplate}><Check className="h-4 w-4" />Save Local</Button>
              <Button onClick={createChakraTemplate}><FileText className="h-4 w-4" />Submit Template</Button>
              <Button variant="ghost" onClick={loadTemplates}><Search className="h-4 w-4" />List Templates</Button>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Outbound Sales Message</h3>
          <p className="mt-1 text-xs text-slate-500">Uses Chakra session message. Server blocks this unless Sales Send is on.</p>
          <div className="mt-4 grid gap-3">
            <input id="sales-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm outline-none focus:border-cyan/50" placeholder="919XXXXXXXXX" />
            <textarea id="sales-text" value={salesText} onChange={(e) => setSalesText(e.target.value)} rows={5} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 outline-none focus:border-cyan/50" />
            <Button id="send-sales-btn" onClick={sendSalesMessage}><Send className="h-4 w-4" />Send Sales Message</Button>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Test Ravi With Sarvam</h3>
          <div className="mt-4 grid gap-3">
            <textarea id="test-ravi-text" value={testText} onChange={(e) => setTestText(e.target.value)} rows={5} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm leading-6 outline-none focus:border-cyan/50" />
            <Button id="test-ravi-btn" variant="ghost" onClick={testRavi} disabled={!testText.trim() || testingRavi}>
              {testingRavi ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Generate Ravi Draft
            </Button>
            {(raviDraft || testingRavi) && (
              <div className="min-h-24 whitespace-pre-wrap rounded-lg border border-cyan/20 bg-cyan/10 p-4 text-sm leading-6 text-cyan-50">
                {raviDraft || "Waiting for first token..."}
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Owner Saved Templates</h3>
          <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
            {(ownerTemplates.data?.templates ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Save common sales, follow-up, seasonal enquiry, and quote reminder templates here.</p>
            ) : (ownerTemplates.data?.templates ?? []).map((template) => (
              <button key={template.id} onClick={() => useLocalTemplate(template)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-medium text-white">{template.name}</div>
                  <Badge tone="cyan">{template.language}</Badge>
                </div>
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{template.body}</div>
              </button>
            ))}
          </div>
        </div>

        {chakraTemplates.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white">ChakraHQ Approved Templates</h3>
            <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
              {chakraTemplates.map((template, index) => (
                <div key={`${template.name ?? index}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-sm font-medium text-white">{template.name ?? "Unnamed template"}</div>
                  <div className="mt-1 text-xs text-slate-500">{template.language ?? template.status ?? "Chakra template"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {status && <div className="mt-5 rounded-xl border border-cyan/20 bg-cyan/10 p-4 text-sm leading-6 text-cyan">{status}</div>}
    </section>
  );
}

function RuntimeTile({ label, enabled, detail }: { label: string; enabled: boolean; detail: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={cn("h-2.5 w-2.5 rounded-full", enabled ? "bg-emerald-300" : "bg-amber-300")} />
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{enabled ? "Ready" : "Off / Missing"}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

/* ─── Quotes Page ──────────────────────────────────────────────── */
function QuotesPage() {
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "all">("pending");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery<{ ok: boolean; quotes: Quote[] }>({
    queryKey: ["quotes"],
    queryFn: () => fetch("/api/quotes").then((r) => r.json()),
    refetchInterval: 10000,
  });

  const quotes = data?.quotes || [];
  const pending = quotes.filter(q => q.owner_approved === 0);  // 0 = pending review, 1 = approved, -1 = rejected
  const approved = quotes.filter(q => q.owner_approved === 1);
  const displayed = activeTab === "pending" ? pending : activeTab === "approved" ? approved : quotes;

  const filtered = search
    ? displayed.filter(q =>
        (q.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (q.quality || "").toLowerCase().includes(search.toLowerCase()) ||
        String(q.size_inches).includes(search)
      )
    : displayed;

  // Sort by newest first
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalValue = filtered.reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const totalPending = pending.reduce((sum, q) => sum + (q.total_amount || 0), 0);

  async function approveQuote(quoteId: string, approved: boolean) {
    setApprovingId(quoteId);
    try {
      await fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, approved }),
      });
      refetch();
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Deal Desk" subtitle={`${pending.length} pending · ${approved.length} approved · ₹${totalPending.toLocaleString("en-IN")} awaiting approval`} />

      {isLoading && <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>}

      {/* Stats bar — 5 cards filling full width */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Pending Review", value: String(pending.length), sub: `₹${totalPending.toLocaleString("en-IN")}`, color: "amber", icon: Clock3 },
            { label: "Approved", value: String(approved.length), sub: `₹${approved.reduce((s, q) => s + (q.total_amount || 0), 0).toLocaleString("en-IN")}`, color: "emerald", icon: Check },
            { label: "Pipeline Total", value: `₹${(totalValue/100000).toFixed(1)}L`, sub: `${quotes.length} quotes`, color: "cyan", icon: DollarSign },
            { label: "Avg Price/kg", value: `₹${quotes.length > 0 ? Math.round(quotes.reduce((s,q) => s + (q.unit_price||0), 0) / quotes.length) : 0}`, sub: "Across all quotes", color: "violet", icon: TrendingUp },
            { label: "Rejected", value: String(quotes.filter(q => q.owner_approved === -1).length), sub: "Needs revision", color: "red", icon: X },
          ].map((card, i) => (
            <div key={i} className={`glass rounded-xl p-4 border border-${card.color}-400/20 bg-${card.color}-400/5`}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-3.5 w-3.5 text-${card.color}-400`} />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{card.label}</span>
              </div>
              <div className={`text-xl font-bold text-${card.color}-400`}>{card.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/5">
          {[
            { key: "pending" as const, label: `Pending (${pending.length})`, color: "amber" },
            { key: "approved" as const, label: `Approved (${approved.length})`, color: "emerald" },
            { key: "all" as const, label: `All (${quotes.length})`, color: "slate" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? `bg-${tab.color}-400/20 text-${tab.color}-400 border border-${tab.color}-400/30`
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, quality, size..."
            className="w-56 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs outline-none focus:border-cyan/50 text-slate-300 placeholder:text-slate-600"
          />
          <select
            onChange={(e) => {
              if (e.target.value === "highest") filtered.sort((a,b) => (b.total_amount||0) - (a.total_amount||0));
              if (e.target.value === "newest") filtered.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-400 outline-none"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest Value</option>
          </select>
        </div>
      </div>

      {/* Quote cards — 2 column grid on large screens */}
      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((quote) => (
          <div key={quote.id} className={`glass rounded-xl p-4 border transition-all hover:border-white/10 ${
            quote.owner_approved === 0 ? 'border-amber-400/20 bg-amber-400/[0.02]' : 'border-white/5'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-white truncate">{quote.customer_name || "Unknown"}</span>
                <Badge tone={quote.owner_approved === 1 ? "green" : quote.owner_approved === -1 ? "red" : "amber"} className="text-[10px]">
                  {quote.owner_approved === 1 ? "✓" : quote.owner_approved === -1 ? "✗" : "Review"}
                </Badge>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-bold text-white">₹{quote.total_amount?.toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-slate-500">₹{quote.unit_price}/kg</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
              <span className="text-white font-medium">{quote.size_inches}" × {quote.grammage}g</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">{quote.quality}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">{quote.lamination || "Unlam"}</span>
              {quote.color && quote.color !== "White" && <><span className="text-slate-600">·</span><span className="text-slate-400">{quote.color}</span></>}
              <span className="text-slate-600">·</span>
              <span className="font-semibold text-cyan">{quote.quantity_kg?.toLocaleString("en-IN")}kg</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                {new Date(quote.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {quote.delivery_city ? ` · ${quote.delivery_city}` : ""}
                {quote.customer_phone ? ` · ${quote.customer_phone.slice(-4)}` : ""}
              </span>

              {quote.owner_approved === 0 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => approveQuote(quote.id, true)}
                    disabled={approvingId === quote.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors border border-emerald-400/20"
                  >
                    {approvingId === quote.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </button>
                  <button
                    onClick={() => approveQuote(quote.id, false)}
                    disabled={approvingId === quote.id}
                    className="p-1 rounded-md bg-red-400/10 hover:bg-red-400/20 text-red-400 transition-colors border border-red-400/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {quote.owner_approved === 1 && (
                <span className="text-emerald-400 text-xs font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Approved</span>
              )}
              {quote.owner_approved === -1 && (
                <span className="text-red-400 text-xs font-medium flex items-center gap-1"><X className="h-3 w-3" /> Rejected</span>
              )}
            </div>
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-700" />
            <p className="text-slate-500">{search ? "No quotes match your search" : "No quotes yet"}</p>
            <p className="mt-1 text-sm text-slate-600">Quotes are generated when Ravi presents pricing to customers.</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Activity Page ────────────────────────────────────────────── */
function ActivityPage() {
  const { data, isLoading, refetch } = useQuery<{ ok: boolean; events: ActivityEvent[] }>({
    queryKey: ["activity-full"],
    queryFn: () => fetch("/api/activity?limit=100").then((r) => r.json()),
    refetchInterval: 5000,
  });

  const events = data?.events || [];

  function getTone(eventType: string): string {
    if (eventType.includes("error") || eventType.includes("fail")) return "red";
    if (eventType.includes("learned") || eventType.includes("memory")) return "green";
    if (eventType.includes("escalat") || eventType.includes("owner")) return "amber";
    if (eventType.includes("ravi") || eventType.includes("response")) return "cyan";
    return "violet";
  }

  return (
    <section className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <ViewHeader title="Activity Feed" subtitle="Real-time operating log across Ravi, Director, Chakra, pricing, and production" compact />
        <Button variant="ghost" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {isLoading && <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>}
      <div className="glass rounded-xl p-5">
        <div className="space-y-3">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  "mt-1 h-2.5 w-2.5 rounded-full shrink-0",
                  getTone(event.event_type) === "green" ? "bg-emerald-400"
                  : getTone(event.event_type) === "violet" ? "bg-violet"
                  : getTone(event.event_type) === "amber" ? "bg-amber-300"
                  : getTone(event.event_type) === "red" ? "bg-red-400"
                  : "bg-cyan"
                )} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="truncate text-sm font-medium text-white">{event.event_type.replace(/_/g, " ")}</h4>
                    <span className="shrink-0 text-[11px] text-slate-500">{new Date(event.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {event.customer_company || event.actor}
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <span className="ml-2 text-slate-600">· {JSON.stringify(event.payload).slice(0, 80)}</span>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          {!isLoading && events.length === 0 && (
            <div className="py-12 text-center">
              <Zap className="mx-auto mb-4 h-12 w-12 text-slate-700" />
              <p className="text-slate-500">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Production Center ───────────────────────────────────────── */
function ProductionCenter() {
  const [activeTab, setActiveTab] = useState<"floor" | "queue" | "capacity">("floor");

  const { data: prodData, isLoading } = useQuery<{ ok: boolean; production: any }>({
    queryKey: ["production-status"],
    queryFn: () => fetch("/api/production/status").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const prod = prodData?.production;
  if (isLoading || !prod) {
    return (
      <section className="h-full overflow-y-auto p-6">
        <ViewHeader title="Production Center" subtitle="Live floor, queue, capacity planning" />
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      </section>
    );
  }

  const tabs = [
    { key: "floor" as const, label: "Live Floor", icon: Factory },
    { key: "queue" as const, label: "Order Queue", icon: CircleDot },
    { key: "capacity" as const, label: "Capacity", icon: Gauge },
  ];

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Production Center" subtitle={`${prod.today.activeCorrugators}/${prod.today.totalCorrugators} corrugators active · ${prod.today.efficiencyPct}% efficiency`} />
      {OPS_UI_ENABLED && <ProductionOps />}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-lg p-1 border border-white/5 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-cyan/20 text-cyan border border-cyan/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "floor" && <ProductionFloor prod={prod} />}
      {activeTab === "queue" && <ProductionQueue prod={prod} />}
      {activeTab === "capacity" && <ProductionCapacity prod={prod} />}
    </section>
  );
}

/* ─── Production: Live Floor ──────────────────────────────────── */
function ProductionFloor({ prod }: { prod: any }) {
  const qc = useQueryClient();
  const t = prod.today;
  const batches = prod.activeBatches || [];
  const corrugators = prod.corrugators || [];
  const delivery = prod.deliveryCalendar || [];

  return (
    <div className="space-y-6">
      {/* Today's KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Produced Today", value: `${(t.producedKg/1000).toFixed(1)}T`, sub: `target ${(t.targetKg/1000).toFixed(1)}T`, color: "emerald" },
          { label: "Active Corrugators", value: `${t.activeCorrugators}`, sub: `${t.idleCorrugators} idle / ${t.totalCorrugators} total`, color: "cyan" },
          { label: "Efficiency", value: `${t.efficiencyPct}%`, sub: `150kg/corrugator target`, color: t.efficiencyPct >= 70 ? "emerald" : "amber" },
          { label: "Orders in Production", value: String(batches.length), sub: `${prod.queue?.filter((q: any) => q.status === 'awaiting_payment').length || 0} awaiting payment`, color: "violet" },
        ].map((kpi, i) => (
          <div key={i} className="glass rounded-xl p-5 border border-white/10">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</div>
            <div className={`text-3xl font-bold text-${kpi.color}-400`}>{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        {/* Corrugator Grid */}
        <div className="glass rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Factory className="h-4 w-4 text-cyan" /> Corrugator Floor — 45 Corrugators
          </h3>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
            {corrugators.map((corrugator: any) => (
              <div
                key={corrugator.id}
                className={`aspect-square rounded-sm flex items-center justify-center text-[8px] font-bold transition-all cursor-pointer ${
                  corrugator.status === 'running'
                    ? 'bg-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-500/20 animate-pulse'
                    : corrugator.status === 'allocated'
                    ? 'bg-amber-500/40 text-amber-200'
                    : 'bg-slate-700/40 text-slate-500 border border-slate-700'
                }`}
                title={corrugator.customerName ? `L${corrugator.id}: ${corrugator.customerName} — ${corrugator.specs} (${corrugator.progressPct}%)` : `Corrugator ${corrugator.id}: Idle`}
              >
                {corrugator.id}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" /> Running</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40" /> Allocated</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700/40" /> Idle</span>
          </div>
        </div>

        {/* Active Batches + Delivery Calendar */}
        <div className="space-y-4">
          <DailyEntryPanel
            activeBatches={batches}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["production-status"] })}
          />

          {/* Delivery Calendar */}
          <div className="glass rounded-xl p-5 border border-white/10">
            <h3 className="text-sm font-semibold text-white mb-3">Upcoming Deliveries</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {delivery.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-black/20 rounded-lg p-2 border border-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-300 truncate">{d.customerName}</div>
                    <div className="text-[10px] text-slate-500">{d.specs} · {d.quantityKg}kg</div>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded font-medium ${
                    d.daysLeft <= 2 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'
                  }`}>
                    {d.daysLeft <= 0 ? 'Today' : d.daysLeft === 1 ? 'Tomorrow' : `${d.daysLeft}d left`}
                  </div>
                </div>
              ))}
              {delivery.length === 0 && <p className="text-xs text-slate-500 text-center py-3">No upcoming deliveries</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Production: Order Queue ────────────────────────────────── */
function ProductionQueue({ prod }: { prod: any }) {
  const queue = prod.queue || [];
  const awaiting = queue.filter((q: any) => q.status === 'awaiting_payment');
  const inProduction = queue.filter((q: any) => q.status === 'in_production');
  const completed = queue.filter((q: any) => q.status === 'complete' || q.status === 'delivered');

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {[
        { title: "Awaiting Payment", items: awaiting, color: "amber", icon: "⏳" },
        { title: "In Production", items: inProduction, color: "cyan", icon: "🏭" },
        { title: "Completed", items: completed, color: "emerald", icon: "✅" },
      ].map((col, ci) => (
        <div key={ci} className={`glass rounded-xl p-5 border border-white/10`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-${col.color}-400/20 text-${col.color}-400 font-bold`}>
              {col.items.length}
            </span>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {col.items.map((order: any) => (
              <div key={order.id} className="bg-black/30 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-semibold text-slate-200 truncate">{order.customerName}</span>
                  {order.quoteAmount > 0 && (
                    <span className="text-xs text-slate-400">₹{(order.quoteAmount/1000).toFixed(0)}K</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded">{order.sizeInches}"</span>
                  <span className="text-[10px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded">{order.grammage}g</span>
                  <span className="text-[10px] text-slate-400 bg-black/40 px-1.5 py-0.5 rounded">{order.quality}</span>
                  <span className="text-[10px] font-medium text-slate-300 bg-black/40 px-1.5 py-0.5 rounded">{order.quantityKg}kg</span>
                  {order.lamination && order.lamination !== 'None' && (
                    <span className="text-[10px] text-slate-500 bg-black/40 px-1.5 py-0.5 rounded">{order.lamination}</span>
                  )}
                </div>
                {order.status === 'in_production' && order.deliveryEstimateDays && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-cyan rounded-full" style={{ width: '45%' }} />
                    </div>
                    <span className="text-slate-500">~{order.deliveryEstimateDays}d</span>
                  </div>
                )}
              </div>
            ))}
            {col.items.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">No orders</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Production: Capacity ───────────────────────────────────── */
function ProductionCapacity({ prod }: { prod: any }) {
  const monthly = prod.monthly || {};
  const utilizationPct = monthly.utilizationPct || 0;
  const bookedT = (monthly.bookedKg || 0) / 1000;
  const availableT = (monthly.availableKg || 202500) / 1000;
  const totalT = bookedT + availableT;

  // Simple weekly breakdown (derived from monthly)
  const weeks = [
    { label: "Week 1 (Jun 1-7)", booked: bookedT * 0.4, available: availableT * 0.25 },
    { label: "Week 2 (Jun 8-14)", booked: bookedT * 0.3, available: availableT * 0.25 },
    { label: "Week 3 (Jun 15-21)", booked: bookedT * 0.2, available: availableT * 0.25 },
    { label: "Week 4 (Jun 22-28)", booked: bookedT * 0.1, available: availableT * 0.25 },
  ];

  return (
    <div className="space-y-6">
      {/* Monthly Overview */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-4">Monthly Capacity — June 2026</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl font-bold text-cyan">{utilizationPct}%</div>
          <div className="text-sm text-slate-400">utilization</div>
        </div>
        <div className="h-5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan to-emerald-400 rounded-full transition-all" style={{ width: `${Math.max(utilizationPct, 2)}%` }}>
            <div className="h-full w-full bg-white/10 animate-[shimmer_2s_infinite]" />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-cyan font-medium">{bookedT.toFixed(1)}T booked</span>
          <span className="text-slate-500">{totalT.toFixed(0)}T total capacity</span>
          <span className="text-emerald-400 font-medium">{availableT.toFixed(0)}T available</span>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-4">Weekly Breakdown</h3>
        <div className="space-y-4">
          {weeks.map((w, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{w.label}</span>
                <span className="text-slate-500">{w.booked.toFixed(1)}T booked</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-cyan/60 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (w.booked / (totalT/4)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* "Can we take this order?" calculator */}
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-2">Feasibility Check</h3>
        <p className="text-xs text-slate-400 mb-3">Quick estimate for new order feasibility</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-black/30 rounded-lg p-3 border border-white/5">
            <div className="text-lg font-bold text-emerald-400">{availableT.toFixed(0)}T</div>
            <div className="text-[10px] text-slate-500">Available This Month</div>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-white/5">
            <div className="text-lg font-bold text-cyan">{prod.today?.activeCorrugators || 0}/{prod.today?.totalCorrugators || 45}</div>
            <div className="text-[10px] text-slate-500">Corrugators Active</div>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-white/5">
            <div className="text-lg font-bold text-violet-400">{(prod.today?.idleCorrugators || 0) * 150}</div>
            <div className="text-[10px] text-slate-500">kg/day Idle Capacity</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analytics Page ───────────────────────────────────────────── */
function AnalyticsPage() {
  const { data: statsData } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;
  const productionData = stats?.sevenDayProduction || [];

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Analytics" subtitle="Conversation quality, quote conversion, and operational visibility" />
      {OPS_UI_ENABLED && <DeliveryAnalytics />}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="7-Day Production Trend">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={productionData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="available" stroke="#38ef7d" fill="#38ef7d33" name="Available T" />
              <Area type="monotone" dataKey="booked" stroke="#8b5cf6" fill="#8b5cf633" name="Booked T" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Customer Stage Breakdown</h3>
          <div className="mt-5 space-y-3">
            {(stats?.stages || []).map((stage) => (
              <div key={stage.stage} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="flex justify-between">
                  <div className="text-sm text-slate-200 capitalize">{stage.stage}</div>
                  <div className="text-sm font-semibold text-white">{stage.count}</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan"
                    style={{ width: `${Math.min(100, stage.count * 10)}%` }}
                  />
                </div>
              </div>
            ))}
            {(!stats?.stages || stats.stages.length === 0) && (
              <p className="text-sm text-slate-500">No customer data yet. Data builds as Ravi has conversations.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Settings Page ────────────────────────────────────────────── */
/* ── API key field definitions shown in the config form ── */
const API_FIELDS = [
  { key: "CHAKRA_API_KEY",        label: "ChakraHQ API Key",      required: true,  hint: "Settings → API Keys in ChakraHQ dashboard" },
  { key: "CHAKRA_PLUGIN_ID",      label: "ChakraHQ Plugin ID",    required: true,  hint: "Settings → Integrations → WhatsApp → Plugin ID" },
  { key: "CHAKRA_PHONE_ID",       label: "WhatsApp Phone ID",     required: true,  hint: "Same page as Plugin ID" },
  { key: "CHAKRA_WABA_ID",        label: "Meta WABA ID",          required: false, hint: "Same page — needed for template messages" },
  { key: "SARVAM_API_KEY",        label: "Sarvam AI Key",         required: false, hint: "app.sarvam.ai → API Keys (for Ravi AI replies)" },
  { key: "PRODUCTION_TEAM_PHONE", label: "Owner WhatsApp Number", required: false, hint: "Your number with country code e.g. 919408724777" },
  { key: "CHAKRA_WEBHOOK_SECRET", label: "Webhook Secret",        required: false, hint: "Optional — for verifying incoming webhooks" },
] as const;

function SettingsPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [formVals, setFormVals] = useState<Record<string, string>>({});
  const [formReady, setFormReady] = useState(false);
  const qc = useQueryClient();

  const { data: healthData, refetch: refetchHealth } = useQuery<{ ok: boolean; health: { healthy: boolean; tables: string[]; issues: string[]; counts: Record<string, number> } }>({
    queryKey: ["db-health"],
    queryFn: () => fetch("/api/db").then((r) => r.json()),
  });

  const { data: configData, refetch: refetchConfig } = useQuery<{
    ok: boolean;
    ready: boolean;
    fields: Array<{ key: string; label: string; configured: boolean; source: string; preview: string }>;
  }>({
    queryKey: ["api-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json()),
    refetchInterval: 0,
  });

  // Init form once config loads
  useEffect(() => {
    if (configData && !formReady) {
      const init: Record<string, string> = {};
      API_FIELDS.forEach(({ key }) => { init[key] = ""; });
      setFormVals(init);
      setFormReady(true);
    }
  }, [configData, formReady]);

  async function saveKeys() {
    setSaving(true);
    setSaveMsg("");
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(formVals)) {
        if (v.trim()) payload[k] = v.trim();
      }
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      setSaveMsg(data.message || (data.ok ? "Saved!" : data.error));
      if (data.ok) {
        refetchConfig();
        qc.invalidateQueries({ queryKey: ["chakra-chats"] });
        // Clear form fields after save
        const cleared: Record<string, string> = {};
        API_FIELDS.forEach(({ key }) => { cleared[key] = ""; });
        setFormVals(cleared);
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 6000);
    }
  }

  async function seedTestData() {
    setSeeding(true);
    setSeedStatus("Seeding test data...");
    try {
      const r = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await r.json();
      setSeedStatus(data.ok ? `✅ Seeded: ${JSON.stringify(data.seeded)}` : `❌ ${data.message}`);
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      refetchHealth();
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedStatus(""), 6000);
    }
  }

  const health = healthData?.health;
  const cfgReady = configData?.ready;

  return (
    <section className="h-full overflow-y-auto p-6">
      <ViewHeader title="Settings" subtitle="Enter your API keys once — saved instantly, no restart needed" />

      {/* ══ API KEY ENTRY FORM ══ */}
      <div className={cn(
        "mb-6 glass rounded-xl p-5 border",
        cfgReady ? "border-emerald-400/20" : "border-amber-400/30"
      )}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-white">API Keys</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Saved to <span className="font-mono">data/keys.json</span> — no restart needed</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={cfgReady ? "green" : "amber"}>{cfgReady ? "Configured ✓" : "Setup Required"}</Badge>
            <button onClick={() => refetchConfig()} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white transition">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Current status row */}
        {configData?.fields && (
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {configData.fields.filter(f => ["CHAKRA_API_KEY","CHAKRA_PLUGIN_ID","CHAKRA_PHONE_ID","SARVAM_API_KEY"].includes(f.key)).map((f) => (
              <div key={f.key} className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                f.configured ? "border-emerald-400/20 bg-emerald-400/5" : "border-red-400/20 bg-red-400/5"
              )}>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", f.configured ? "bg-emerald-400" : "bg-red-500")} />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-slate-300">{f.key}</p>
                  {f.configured
                    ? <p className="text-[10px] text-emerald-400">{f.preview} ({f.source})</p>
                    : <p className="text-[10px] text-red-400">Not set</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Key entry fields */}
        <div className="space-y-3">
          {API_FIELDS.map(({ key, label, required, hint }) => (
            <div key={key}>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                {label}
                {required && <span className="text-red-400">*</span>}
                <span className="font-mono text-[10px] text-slate-600">{key}</span>
              </label>
              <div className="relative">
                <input
                  type={showKeys[key] ? "text" : "password"}
                  value={formVals[key] ?? ""}
                  onChange={(e) => setFormVals((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={`Enter ${label}...`}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 pr-9 font-mono text-xs text-slate-100 outline-none transition focus:border-cyan/60 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys((p) => ({ ...p, [key]: !p[key] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
                >
                  {showKeys[key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={saveKeys} disabled={saving} className="flex-1">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Keys"}
          </Button>
          <a
            href="https://app.chakrahq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> ChakraHQ
          </a>
        </div>

        {saveMsg && (
          <div className={cn(
            "mt-3 rounded-lg border px-4 py-2.5 text-xs",
            saveMsg.includes("error") || saveMsg.includes("Error")
              ? "border-red-400/30 bg-red-400/10 text-red-300"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          )}>
            {saveMsg}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-black/40 p-3 text-[11px] text-slate-500">
          <p className="font-semibold text-slate-400 mb-1">Where to find your keys:</p>
          <p>1. <span className="text-cyan">app.chakrahq.com</span> → Settings → <b>API Keys</b> → copy key</p>
          <p>2. Settings → Integrations → <b>WhatsApp</b> → Plugin ID + Phone ID + WABA ID</p>
          <p>3. Keys are saved to <span className="font-mono text-slate-300">data/keys.json</span> and used immediately — no file editing or restarts needed.</p>
        </div>
      </div>

      {/* ══ Database Health ══ */}
      <div className="mb-6 glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Database Health</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", health?.healthy ? "bg-emerald-400" : "bg-red-400")} />
              <span className="text-sm text-white">{health?.healthy ? "SQLite Healthy" : health ? "Issues found" : "Checking..."}</span>
            </div>
            {!health && (
              <p className="mt-2 text-[11px] text-amber-400">SQLite may need rebuild — double-click START_APP.command</p>
            )}
            {health && (
              <div className="mt-2 space-y-1">
                {Object.entries(health.counts).map(([table, count]) => (
                  <div key={table} className="flex justify-between text-xs text-slate-500">
                    <span>{table}</span><span>{count} rows</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Button variant="ghost" onClick={() => refetchHealth()} className="w-full">
              <RefreshCw className="h-4 w-4" />Check Health
            </Button>
            <Button onClick={seedTestData} disabled={seeding} className="w-full">
              {seeding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Seed Test Data
            </Button>
            {seedStatus && <p className="text-xs text-cyan">{seedStatus}</p>}
          </div>
        </div>
        {health?.issues && health.issues.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3">
            {health.issues.map((issue, i) => (
              <p key={i} className="text-xs text-red-300">{issue}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══ v3 SCREENS — Guidelines v3 + reference mockup ═════════════ */

type CorrugatorFloor = {
  total_corrugators: number;
  corrugators_available: number;
  corrugators_maintenance: number;
  corrugators_external: number;
  corrugators_in_system: number;
  updated_by: string;
  notes: string | null;
  updated_at: string;
};

type CorrugatorApiResponse = {
  ok: boolean;
  floor: CorrugatorFloor;
  monthlyCapacity?: Array<{ monthKey: string; totalKg: number; bookedKg: number; availableKg: number; utilizationPct: number }>;
};

/* ─── Corrugator Floor (digital twin of the factory floor) ───────────── */
function CorrugatorFloorPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<CorrugatorApiResponse>({
    queryKey: ["corrugator-floor"],
    queryFn: () => fetch("/api/corrugator").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const [editing, setEditing] = useState(false);
  const [available, setAvailable] = useState(45);
  const [maintenance, setMaintenance] = useState(0);
  const [external, setExternal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const floor = data?.floor;
  useEffect(() => {
    if (floor) {
      setAvailable(floor.corrugators_available);
      setMaintenance(floor.corrugators_maintenance);
      setExternal(floor.corrugators_external);
    }
  }, [floor]);

  async function saveFloor() {
    setSaving(true);
    try {
      const r = await fetch("/api/corrugator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrugators_available: available, corrugators_maintenance: maintenance, corrugators_external: external, updated_by: "owner" }),
      });
      const res = await r.json();
      if (res.ok) {
        setStatus("✅ Corrugator floor updated — capacity, ETA & dispatch recomputed");
        setEditing(false);
        qc.invalidateQueries({ queryKey: ["corrugator-floor"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["agent-runtime-state"] });
      } else setStatus(`❌ ${res.error || "Failed"}`);
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(""), 4000);
      void refetch();
    }
  }

  const cap = data?.monthlyCapacity?.[0];
  const free = floor?.corrugators_available ?? 45;
  const used = (floor?.corrugators_in_system ?? 0) + (floor?.corrugators_external ?? 0) + (floor?.corrugators_maintenance ?? 0);
  const effMonthly = free * 150 * 30;

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Corrugator Floor" subtitle="Digital twin of your 45-corrugator factory. When you take an offline order, update the free count — ALL capacity, ETA & dispatch auto-recompute." />

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 lg:grid-cols-4">
            <CorrugatorKpi label="Free Now" value={String(free)} sub="Available for new orders" tone="green" Icon={Factory} />
            <CorrugatorKpi label="On System Orders" value={String(floor?.corrugators_in_system ?? 0)} sub="Allocated via this agent" tone="cyan" Icon={Bot} />
            <CorrugatorKpi label="External / Offline" value={String(floor?.corrugators_external ?? 0)} sub="Non-system orders" tone="violet" Icon={Cpu} />
            <CorrugatorKpi label="Maintenance" value={String(floor?.corrugators_maintenance ?? 0)} sub="Down for repair" tone="amber" Icon={Gauge} />
          </div>

          {/* Corrugator grid visualization — mirrors the mockup's 45-cell grid */}
          <div className="glass mt-6 rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Corrugator Status Grid — {floor?.total_corrugators ?? 45} Corrugators</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Effective monthly capacity: <span className="text-emerald-400 font-semibold">{(effMonthly / 1000).toFixed(1)}T</span> ({free} free × 150 × 30)
                </p>
              </div>
              <Badge tone={free > 0 ? "green" : "red"}>{free > 0 ? `${free} free` : "No free corrugators"}</Badge>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
              {Array.from({ length: floor?.total_corrugators ?? 45 }).map((_, i) => {
                const inSystem = floor?.corrugators_in_system ?? 0;
                const ext = floor?.corrugators_external ?? 0;
                const maint = floor?.corrugators_maintenance ?? 0;
                const idle = floor?.corrugators_available ?? 45;
                // Render order: system → external → maintenance → free
                let kind: "system" | "external" | "maintenance" | "free" = "free";
                if (i < inSystem) kind = "system";
                else if (i < inSystem + ext) kind = "external";
                else if (i < inSystem + ext + maint) kind = "maintenance";
                else if (i < inSystem + ext + maint + idle) kind = "free";
                else kind = "free";
                const styles = {
                  system: "bg-emerald-400/80 shadow-sm shadow-emerald-400/30",
                  external: "bg-violet/70",
                  maintenance: "bg-amber-400/60",
                  free: "bg-slate-700/50 border border-slate-700",
                }[kind];
                const labels = { system: "On system order", external: "External order", maintenance: "Maintenance", free: "Free" }[kind];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.008 }}
                    className={cn("aspect-square rounded-sm transition-all duration-500", styles)}
                    title={`Corrugator ${i + 1}: ${labels}`}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-400">
              <Legend color="bg-emerald-400/80" label={`On system (${floor?.corrugators_in_system ?? 0})`} />
              <Legend color="bg-violet/70" label={`External (${floor?.corrugators_external ?? 0})`} />
              <Legend color="bg-amber-400/60" label={`Maintenance (${floor?.corrugators_maintenance ?? 0})`} />
              <Legend color="bg-slate-700/50 border border-slate-700" label={`Free (${floor?.corrugators_available ?? 0})`} />
            </div>
          </div>

          {/* Owner control */}
          <div className="glass mt-6 rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Update Corrugator Floor</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tell Director "5 corrugators busy with offline order" or adjust here. Last updated by {floor?.updated_by} · {floor?.updated_at ? new Date(floor.updated_at).toLocaleString() : ""}
                </p>
              </div>
              {!editing && (
                <Button onClick={() => setEditing(true)}><Cpu className="h-4 w-4" />Edit Floor</Button>
              )}
            </div>

            {editing ? (
              <div className="grid gap-4 md:grid-cols-3">
                <CorrugatorSlider label="Free corrugators" value={available} setValue={setAvailable} max={floor?.total_corrugators ?? 45} />
                <CorrugatorSlider label="Maintenance" value={maintenance} setValue={setMaintenance} max={floor?.total_corrugators ?? 45} />
                <CorrugatorSlider label="External / Offline" value={external} setValue={setExternal} max={floor?.total_corrugators ?? 45} />
                <div className="md:col-span-3 flex items-center gap-3">
                  <Button onClick={saveFloor} disabled={saving}>
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save & Recompute
                  </Button>
                  <Button variant="ghost" onClick={() => { setEditing(false); }}>Cancel</Button>
                  {status && <span className="text-sm text-cyan">{status}</span>}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <FloorStat label="Free" value={floor?.corrugators_available ?? 0} tone="text-emerald-400" />
                <FloorStat label="Maintenance" value={floor?.corrugators_maintenance ?? 0} tone="text-amber-400" />
                <FloorStat label="External" value={floor?.corrugators_external ?? 0} tone="text-violet" />
              </div>
            )}
            {status && !editing && <p className="mt-3 text-sm text-cyan">{status}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function CorrugatorKpi({ label, value, sub, tone, Icon }: { label: string; value: string; sub: string; tone: "green" | "cyan" | "violet" | "amber" | "red"; Icon: any }) {
  const toneColor = tone === "green" ? "text-emerald-400" : tone === "violet" ? "text-violet" : tone === "amber" ? "text-amber-400" : tone === "red" ? "text-red-400" : "text-cyan";
  const borderColor = tone === "green" ? "border-emerald-400/30" : tone === "violet" ? "border-violet/30" : tone === "amber" ? "border-amber-400/30" : tone === "red" ? "border-red-400/30" : "border-cyan/30";
  return (
    <div className={cn("glass rounded-xl p-5 border-t", borderColor)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", toneColor)} />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-3xl font-bold", toneColor)}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={cn("inline-block w-3 h-3 rounded-sm", color)} />{label}</span>;
}

function FloorStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className={cn("text-2xl font-bold", tone)}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function CorrugatorSlider({ label, value, setValue, max }: { label: string; value: number; setValue: (n: number) => void; max: number }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-2">{label}: <span className="text-white font-semibold">{value}</span></label>
      <input type="range" min={0} max={max} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-cyan" />
    </div>
  );
}

/* ─── Payment Gate (Token 10–25%, 3-day sequence) ──────────────── */
function PaymentGatePage() {
  const qc = useQueryClient();
  const { data: statsData, isLoading } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });
  const stats = statsData?.stats;
  const pending = stats?.paymentsPending || [];
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleConfirm(enquiryId: string) {
    if (!confirm("Confirm advance payment received? Customer gets WhatsApp notification and production starts.")) return;
    setConfirming(enquiryId);
    try {
      const r = await fetch("/api/orders/confirm-payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId }),
      });
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        alert("✅ Token received & production started. Customer notified.");
      } else {
        alert("❌ Failed to confirm payment");
      }
    } catch {
      alert("❌ Failed to confirm payment");
    } finally {
      setConfirming(null);
    }
  }

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Payment Gate" subtitle="Token / advance (10%–25%) required before production starts. Ravi follows up automatically; cancellations are tracked." />
      {OPS_UI_ENABLED && <OpsApprovals />}
      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <CorrugatorKpi label="Awaiting Token" value={String(stats?.paymentsPendingCount ?? 0)} sub="Production blocked" tone="amber" Icon={AlertTriangle} />
            <CorrugatorKpi label="In Production" value={String((stats?.allEnquiries || []).filter((o: any) => o.status === "in_production").length)} sub="Token received" tone="green" Icon={Factory} />
            <CorrugatorKpi label="Total Pending ₹" value={`₹${(pending.reduce((s, p: any) => s + ((p.quantityKg || 0) * 80), 0) / 1000).toFixed(0)}K`} sub="Order value estimate" tone="violet" Icon={DollarSign} />
            <CorrugatorKpi label="Pipeline Orders" value={String((stats?.allEnquiries || []).length)} sub="All stages" tone="cyan" Icon={FileText} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <DunningWidget paymentsPending={pending as any[]} />
            
            <div className="glass rounded-xl p-6 border border-white/10">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">💳 Token Confirmation Actions</h3>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-slate-500">
                  <Check className="h-8 w-8 text-emerald-400/50 mb-2" />
                  <p className="text-sm">No orders awaiting payment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((p: any) => {
                    const orderValue = (p.quantityKg || 0) * 80;
                    const tokenMin = Math.round(orderValue * 0.1);
                    const tokenMax = Math.round(orderValue * 0.25);
                    return (
                      <div key={p.enquiryId} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-amber-300">{p.customerName}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{p.sizeInches}" · {p.grammage}g · {p.quality} · {p.quantityKg}kg</div>
                            <div className="text-xs text-slate-500 mt-1">Order value ≈ ₹{orderValue.toLocaleString("en-IN")} · Confirmed {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}</div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">Min ₹{tokenMin.toLocaleString("en-IN")} (10%)</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">Max ₹{tokenMax.toLocaleString("en-IN")} (25%)</span>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleConfirm(p.enquiryId)} disabled={confirming === p.enquiryId}>
                            {confirming === p.enquiryId ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Confirm Token
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-cyan/20 bg-cyan/5 p-3 text-xs text-slate-300">
            ℹ Ravi auto-follows up: Day 1 payment request → Day 2 reminder → Day 3 final warning → auto-cancel + hierarchy notified. Cancelled clients are flagged for future upfront payment.
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Dispatch Schedule (14-day rolling) ───────────────────────── */
function DispatchSchedulePage() {
  const { data: statsData, isLoading } = useQuery<{ ok: boolean; stats: DashboardStats }>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const inProduction = (statsData?.stats?.allEnquiries || []).filter((o: any) => o.status === "in_production");
  const ready = (statsData?.stats?.allEnquiries || []).filter((o: any) => o.status === "complete" || o.status === "delivered");
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Dispatch Schedule" subtitle="14-day rolling view · Ravi auto-WhatsApps client 3 days before ETA · Client confirms transport on WhatsApp" />
      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <CorrugatorKpi label="In Production" value={String(inProduction.length)} sub="Approaching dispatch" tone="cyan" Icon={Factory} />
            <CorrugatorKpi label="Ready / Dispatched" value={String(ready.length)} sub="Completed orders" tone="green" Icon={Check} />
            <CorrugatorKpi label="Total Corrugators" value={String(statsData?.stats?.totalCorrugators ?? 45)} sub="Factory floor" tone="violet" Icon={Factory} />
            <CorrugatorKpi label="Booked (T)" value={`${((statsData?.stats?.bookedKg ?? 0) / 1000).toFixed(1)}T`} sub="This month" tone="amber" Icon={Gauge} />
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">📅 14-Day Rolling Dispatch Calendar</h3>
            <div className="overflow-x-auto">
              <div className="grid gap-2 min-w-[1100px]" style={{ gridTemplateColumns: "repeat(14, 1fr)" }}>
                {days.map((d, i) => {
                  const isToday = i === 0;
                  const dayStr = d.toISOString().split("T")[0];
                  const dayOrders = inProduction.slice(0, 3); // placeholder mapping
                  return (
                    <div key={i} className={cn(
                      "rounded-lg border p-2 min-w-[75px]",
                      isToday ? "border-cyan/40 bg-cyan/10" : "border-white/10 bg-white/[0.03]"
                    )}>
                      <div className={cn("text-[9px] font-bold uppercase mb-1", isToday ? "text-cyan" : "text-slate-500")}>
                        {isToday ? "TODAY" : ""}<br />{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                      {i < inProduction.length ? (
                        <div className="rounded border border-white/10 bg-black/30 p-1.5">
                          <div className="text-[10px] font-semibold text-slate-200 truncate">{inProduction[i]?.customerName}</div>
                          <div className="text-[9px] text-slate-500">{inProduction[i]?.quantityKg}kg</div>
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-600 text-center py-2 italic">No dispatch</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-slate-300">
              ℹ Ravi auto-sends WhatsApp 3 days before ETA: <em>"Your order [spec] is ready for dispatch on [date]. Please arrange your transporter and confirm."</em>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Cancelled Orders (audit trail) ───────────────────────────── */
function CancelledOrdersPage() {
  const { data, isLoading } = useQuery<{ ok: boolean; orders?: any[] }>({
    queryKey: ["cancelled-orders"],
    queryFn: () => fetch("/api/orders/cancelled").then((r) => r.json()),
    refetchInterval: 30000,
  });
  const orders = data?.orders || [];

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Cancelled Orders" subtitle="Orders lost due to non-payment, follow-up failure, or client withdrawal. Full audit trail maintained for 90 days." />
      {OPS_UI_ENABLED && <CancellationsOps />}
      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3 mb-6">
            <CorrugatorKpi label="Cancelled" value={String(orders.length)} sub="All time in log" tone="amber" Icon={AlertTriangle} />
            <CorrugatorKpi label="Revenue Lost" value={`₹${(orders.reduce((s: number, o: any) => s + (o.order_value || 0), 0) / 1000).toFixed(0)}K`} sub="Total value" tone="red" Icon={DollarSign} />
            <CorrugatorKpi label="Flagged Clients" value={String(new Set(orders.map((o: any) => o.customer_phone)).size)} sub="Require upfront payment" tone="violet" Icon={ShieldCheck} />
          </div>

          <div className="glass rounded-xl p-6 border border-white/10">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">❌ Cancelled Order Log</h3>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Check className="h-8 w-8 text-emerald-400/50 mb-2" />
                <p className="text-sm">No cancelled orders. All healthy.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-500 uppercase border-b border-white/10">
                      <th className="py-2 px-2">Customer</th><th className="py-2 px-2">Spec</th><th className="py-2 px-2">Value</th>
                      <th className="py-2 px-2">Days</th><th className="py-2 px-2">Follow-ups</th><th className="py-2 px-2">Reason</th><th className="py-2 px-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => (
                      <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 px-2"><div className="font-semibold text-slate-200">{o.customer_name || "Unknown"}</div><div className="text-[10px] text-slate-500">{o.customer_phone}</div></td>
                        <td className="py-2 px-2 text-xs text-slate-400">{o.size_inches}" · {o.grammage}g · {o.quality} · {o.quantity_kg}kg</td>
                        <td className="py-2 px-2 font-mono text-amber-400">₹{(o.order_value || 0).toLocaleString("en-IN")}</td>
                        <td className="py-2 px-2 text-xs">{o.days_elapsed ?? "—"}d</td>
                        <td className="py-2 px-2 text-xs">{o.followups_sent ?? 0}</td>
                        <td className="py-2 px-2"><Badge tone="red">{(o.reason || "non_payment").replace(/_/g, " ")}</Badge></td>
                        <td className="py-2 px-2 text-xs text-slate-400">{o.cancelled_by || "auto"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-xs text-slate-500">Cancelled clients are flagged — Ravi requires full upfront payment for future orders. Only hierarchy can remove a flag.</div>
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Trading Desk (proactive / reactive sourcing) ─────────────── */
function TradingDeskPage() {
  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Trading Desk" subtitle="Third-party sourcing when own production can't fulfil or for urgent buyers. Two-trigger model: proactive (30-day rule) & reactive (never refuse)." />
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <CorrugatorKpi label="Proactive" value="0" sub="Overflow capacity" tone="cyan" Icon={RefreshCw} />
        <CorrugatorKpi label="Reactive" value="0" sub="Urgent buyers" tone="amber" Icon={Zap} />
        <CorrugatorKpi label="Quality Gate" value="0" sub="Awaiting clearance" tone="violet" Icon={ShieldCheck} />
        <CorrugatorKpi label="Dispatched" value="0" sub="Sourced & delivered" tone="green" Icon={Check} />
      </div>
      <div className="glass rounded-xl p-6 border border-white/10">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">🔄 Trading Desk Rules</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4">
            <div className="text-sm font-semibold text-cyan mb-2">Proactive Trigger</div>
            <p className="text-xs text-slate-300 leading-5">Fires when 30-day own-production order book is fully covered AND overflow capacity exists. 30-day rule APPLIES. Hierarchy notified: Puneet → Dev → Manager.</p>
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="text-sm font-semibold text-amber-300 mb-2">Reactive Trigger</div>
            <p className="text-xs text-slate-300 leading-5">Client is NEVER refused. When own production can't meet an urgent timeline, sourcing begins immediately. 30-day rule WAIVED. Hierarchy notified instantly.</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-slate-300">
          🔒 Quality Gate: No third-party box dispatches without a lab report OR approved samples. Approval authority: Puneet → Dev → Manager. Own production always takes priority.
        </div>
      </div>
    </section>
  );
}

/* ─── Seasonal Demand (4-dimension framework) ──────────────────── */
const MONTH_ABBR = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
function SeasonalDemandPage() {
  const [tab, setTab] = useState<"client" | "size" | "quality" | "region">("client");
  const [rebuilding, setRebuilding] = useState(false);
  const tabs = [
    { key: "client" as const, label: "Client-wise", icon: "👤" },
    { key: "size" as const, label: "Size-wise", icon: "📐" },
    { key: "quality" as const, label: "Quality-wise", icon: "🏅" },
    { key: "region" as const, label: "Region-wise", icon: "🗺" },
  ];
  const { data, isLoading, refetch } = useQuery<{ ok: boolean; rows: Array<{ label: string; peakMonths: number[]; peakMonthsLabel: string; typicalKg: number | null }> }>({
    queryKey: ["seasonal", tab],
    queryFn: () => fetch(`/api/seasonal?dimension=${tab}`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 60000,
  });
  const rows = data?.rows || [];

  async function rebuild() {
    setRebuilding(true);
    try { await fetch("/api/demand/rebuild", { method: "POST", credentials: "include" }); await refetch(); }
    finally { setRebuilding(false); }
  }

  return (
    <section className="h-full w-full flex-1 overflow-y-auto p-6">
      <ViewHeader title="Seasonal Demand" subtitle="Demand intelligence — declared (asked) + derived (from order history). Four dimensions: Client, Size, Quality, Region." />
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition",
                tab === t.key ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <button onClick={rebuild} disabled={rebuilding}
          className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs text-cyan transition hover:bg-cyan/20 disabled:opacity-50">
          {rebuilding ? "Rebuilding…" : "Rebuild from orders"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-cyan" /></div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-xl border border-white/10 p-8 text-center">
          <div className="mb-3 text-5xl">{tabs.find((t) => t.key === tab)?.icon}</div>
          <h3 className="mb-2 text-base font-semibold text-slate-300">No {tab}-wise data yet</h3>
          <p className="mx-auto max-w-md text-sm leading-6 text-slate-500">
            This populates as orders flow in (derived seasonality) and as Ravi captures peak-month answers. Click <span className="text-cyan">Rebuild from orders</span> after orders exist.
          </p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{tab}</th>
                {MONTH_ABBR.map((m, i) => (
                  <th key={i} className="px-2 py-2.5 text-center text-[10px] font-medium text-slate-500">{m}</th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-slate-400">Typical KG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, ri) => (
                <tr key={ri} className="text-slate-300">
                  <td className="px-3 py-2.5 font-medium text-white">{r.label}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((mn) => {
                    const peak = r.peakMonths.includes(mn);
                    return <td key={mn} className="px-1 py-2.5 text-center">
                      <span className={cn("inline-block h-4 w-4 rounded-sm", peak ? "bg-emerald-400/70" : "bg-white/[0.05]")} title={peak ? "Peak" : ""} />
                    </td>;
                  })}
                  <td className="px-3 py-2.5 text-right text-xs text-slate-400">{r.typicalKg ? `${r.typicalKg}kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">Green = peak demand month. Client peaks use declared answers (fallback: order-history seasonality); size/quality/region peaks are derived from order timestamps.</p>
    </section>
  );
}

/* ─── Shared Components ────────────────────────────────────────── */
function ViewHeader({ title, subtitle, compact = false }: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", compact && "mb-4")}>
      <div>
        <h1 className={cn("font-semibold text-white", compact ? "text-lg" : "text-2xl")}>{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <Badge tone="cyan">Realtime</Badge>
      </div>
      {children}
    </div>
  );
}

function LiveActivityList({ events }: { events: ActivityEvent[] }) {
  function getEventUI(eventType: string) {
    if (eventType.includes("error") || eventType.includes("fail")) return { Icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" };
    if (eventType.includes("learned") || eventType.includes("memory")) return { Icon: Brain, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" };
    if (eventType.includes("escalat") || eventType.includes("owner")) return { Icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" };
    if (eventType.includes("quote") || eventType.includes("payment")) return { Icon: FileText, color: "text-violet", bg: "bg-violet/10 border-violet/20" };
    if (eventType.includes("ravi")) return { Icon: Bot, color: "text-cyan", bg: "bg-cyan/10 border-cyan/20" };
    return { Icon: Zap, color: "text-slate-300", bg: "bg-white/5 border-white/10" };
  }

  return (
    <div className="space-y-3">
      {events.length === 0 && (
        <p className="text-xs text-slate-500">Waiting for activity...</p>
      )}
      {events.map((event) => {
        const { Icon, color, bg } = getEventUI(event.event_type);
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-xl border ${bg} p-4 transition-all hover:bg-opacity-20`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h4 className={`truncate text-sm font-semibold ${color}`}>{event.event_type.replace(/_/g, " ")}</h4>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">{new Date(event.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-300">{event.customer_company || event.actor}</p>
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-400 bg-black/20 p-2 rounded-md font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                    {JSON.stringify(event.payload)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Unified Approval Modal (Guidelines §8) ──────────────────── */
/* Reusable across escalations / tokens / trading / quality gate / deal desk.
   Stamps "[Action] by [Approver] at [HH:MM, Date]" via /api/approvals. */

type ApprovalRequest = {
  refType: "escalation" | "token" | "trading" | "quality_gate" | "deal_desk" | "base_price";
  refId?: string;
  title: string;
  spec: string;
  customerName?: string;
};

type ApprovalStore = {
  request: ApprovalRequest | null;
  listeners: Set<() => void>;
};

const approvalStore: ApprovalStore = { request: null, listeners: new Set() };

function emitApproval() {
  approvalStore.listeners.forEach((l) => l());
}

/** Open the unified approval modal from anywhere in the app. */
function openApproval(req: ApprovalRequest) {
  approvalStore.request = req;
  emitApproval();
}

function useApprovalRequest() {
  const [req, setReq] = useState<ApprovalRequest | null>(approvalStore.request);
  useEffect(() => {
    const listener = () => setReq(approvalStore.request);
    approvalStore.listeners.add(listener);
    return () => { approvalStore.listeners.delete(listener); };
  }, []);
  return req;
}

function ApprovalModal() {
  const req = useApprovalRequest();
  const [approver, setApprover] = useState("");
  const [action, setAction] = useState("Approved");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (req) { setApprover(""); setAction("Approved"); setNotes(""); setToast(null); }
  }, [req]);

  if (!req) return null;

  function close() {
    approvalStore.request = null;
    emitApproval();
  }

  async function submit() {
    if (!approver) { setToast("⚠ Please select who is approving."); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refType: req!.refType,
          refId: req!.refId,
          customerName: req!.customerName,
          spec: req!.spec,
          approver,
          action,
          notes,
        }),
      });
      const res = await r.json();
      if (res.ok) {
        setToast(`✅ ${res.stamp} — agent notified`);
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["agent-runtime-state"] });
        setTimeout(close, 1200);
      } else {
        setToast(`❌ ${res.error || "Failed to stamp approval"}`);
      }
    } catch {
      setToast("❌ Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-cyan/30 bg-ink p-6 shadow-glow"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan/10 border border-cyan/20"><ShieldCheck className="h-4 w-4 text-cyan" /></div>
                <h3 className="text-base font-semibold text-white">{req.title}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">Approval stamped with name + timestamp · Agent resumes on approval</p>
            </div>
            <button onClick={close} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300 leading-6">
            {req.spec}
          </div>

          <div className="mt-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Who is approving? *</label>
            <div className="grid grid-cols-3 gap-2">
              {["Puneet", "Dev", "Manager"].map((a) => (
                <button key={a} onClick={() => setApprover(a)}
                  className={cn("rounded-lg border px-3 py-2 text-xs font-semibold transition",
                    approver === a ? "border-cyan bg-cyan/15 text-cyan" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white")}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Action</label>
            <div className="grid grid-cols-3 gap-2">
              {["Approved", "Declined", "Modify"].map((a) => (
                <button key={a} onClick={() => setAction(a === "Modify" ? "Approved with Modification" : a)}
                  className={cn("rounded-lg border px-2 py-2 text-[11px] font-semibold transition",
                    (action === a || (a === "Modify" && action === "Approved with Modification"))
                      ? (action === "Declined" ? "border-red-400/40 bg-red-400/10 text-red-400" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-400")
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white")}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved at ₹95/kg, dispatch by July 5…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan/50" />
          </div>

          {toast && <div className="mt-3 text-sm text-cyan">{toast}</div>}

          <div className="mt-5 flex gap-2">
            <Button onClick={submit} disabled={submitting} className="flex-1 justify-center">
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm & Notify Agent
            </Button>
            <Button variant="ghost" onClick={close}>Cancel</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const tooltipStyle = {
  background: "rgba(8, 13, 22, 0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  color: "#e5eefc",
};


