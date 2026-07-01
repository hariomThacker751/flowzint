'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, Clock3, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
interface Escalation {
  id: string;
  customerName: string;
  customerPhone: string;
  question: string;
  createdAt?: string;
}

interface PaymentPending {
  enquiryId: string;
  customerName: string;
  customerPhone: string;
  quantityKg: number;
  quality: string;
  sizeInches: number;
  grammage: number;
  lamination?: string;
  quoteAmount?: number;
  createdAt?: string;
}

interface ApprovalsQueueProps {
  escalations: Escalation[];
  paymentsPending: PaymentPending[];
  onConfirmPayment: (enquiryId: string) => void;
  onNavigateToDirector: (ctx: { escalationId: string; customerName: string; customerPhone: string; question: string }) => void;
  totalCount: number;
}

/* ─── Time formatting ─────────────────────────────────────────── */
function parseDate(dateStr: string): number {
  if (!dateStr) return 0;
  const s = dateStr.trim();
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s).getTime();
  return new Date(s + 'Z').getTime();
}

function timeAgo(dateStr: string): string {
  const ts = parseDate(dateStr);
  if (!ts || isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ─── Payment Row ─────────────────────────────────────────────── */
function PaymentRow({ item, onConfirm, isSelected, onSelect }: {
  item: PaymentPending;
  onConfirm: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await Promise.resolve(); // tick
      onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl border p-3.5 transition-all ${
        isSelected
          ? 'border-amber-400/40 bg-amber-400/[0.08]'
          : 'border-amber-400/15 bg-amber-400/[0.03] hover:border-amber-400/30 hover:bg-amber-400/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-300">{item.customerName}</span>
            {item.createdAt && (
              <span className="text-[10px] text-slate-500">{timeAgo(item.createdAt)}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.sizeInches}"</span>
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.grammage}g</span>
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.quality}</span>
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              {item.quantityKg?.toLocaleString('en-IN')}kg
            </span>
            {item.lamination && item.lamination !== 'None' && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-500">{item.lamination}</span>
            )}
          </div>
          {item.quoteAmount && item.quoteAmount > 0 && (
            <div className="mt-1 text-[10px] text-amber-400/70">
              Token: ₹{Math.round(item.quoteAmount * 0.15 / 100) * 100}–₹{Math.round(item.quoteAmount * 0.25 / 100) * 100} expected
            </div>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
        disabled={confirming}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
      >
        {confirming ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Confirm Token Received
      </button>
    </motion.div>
  );
}

/* ─── Escalation Row ─────────────────────────────────────────── */
function EscalationRow({ item, onNavigateToDirector, isSelected, onSelect }: {
  item: Escalation;
  onNavigateToDirector: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl border p-3.5 transition-all ${
        isSelected
          ? 'border-red-400/40 bg-red-400/[0.08]'
          : 'border-red-400/15 bg-red-400/[0.03] hover:border-red-400/30 hover:bg-red-400/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-red-300">{item.customerName}</span>
        <div className="flex items-center gap-2">
          {item.createdAt && <span className="text-[10px] text-slate-500">{timeAgo(item.createdAt)}</span>}
          <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">Escalated</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 leading-5 line-clamp-2 mb-2.5 italic">
        "{item.question}"
      </p>
      <button
        onClick={(e) => { e.stopPropagation(); onNavigateToDirector(); }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 py-2 text-[11px] font-medium text-red-400 transition hover:bg-red-400/20"
      >
        <ChevronRight className="h-3 w-3" /> Reply in Director AI
      </button>
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export function ApprovalsQueue({
  escalations,
  paymentsPending,
  onConfirmPayment,
  onNavigateToDirector,
  totalCount,
}: ApprovalsQueueProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'payments' | 'escalations'>('all');

  const showPayments = filter !== 'escalations';
  const showEscalations = filter !== 'payments';

  return (
    <div className="glass rounded-xl p-5 flex flex-col h-full border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-400/10 rounded-lg border border-red-400/20">
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Owner Action Inbox</h3>
          <p className="text-xs text-slate-400">Payments · Escalations · Approvals</p>
        </div>
        {totalCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-red-400/20 text-red-400 text-xs font-bold">
            {totalCount}
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      {totalCount > 0 && (
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/5 mb-3">
          {[
            { key: 'all' as const, label: `All (${totalCount})` },
            { key: 'payments' as const, label: `Payments (${paymentsPending.length})` },
            { key: 'escalations' as const, label: `Escalations (${escalations.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 rounded-md py-1 text-[10px] font-medium transition-all ${
                filter === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {totalCount === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-400">Inbox Zero</p>
            <p className="text-xs text-slate-600">All clear — no action needed</p>
          </div>
        ) : (
          <AnimatePresence>
            {showPayments && paymentsPending.map((p) => (
              <PaymentRow
                key={p.enquiryId}
                item={p}
                onConfirm={() => onConfirmPayment(p.enquiryId)}
                isSelected={selectedId === p.enquiryId}
                onSelect={() => setSelectedId(selectedId === p.enquiryId ? null : p.enquiryId)}
              />
            ))}
            {showEscalations && escalations.map((e) => (
              <EscalationRow
                key={e.id}
                item={e}
                onNavigateToDirector={() =>
                  onNavigateToDirector({
                    escalationId: e.id,
                    customerName: e.customerName,
                    customerPhone: e.customerPhone,
                    question: e.question,
                  })
                }
                isSelected={selectedId === e.id}
                onSelect={() => setSelectedId(selectedId === e.id ? null : e.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}



