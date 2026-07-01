'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

/* ─── Types ────────────────────────────────────────────────────── */
interface PaymentPending {
  enquiryId: string;
  customerName: string;
  customerPhone: string;
  quantityKg: number;
  quality: string;
  sizeInches: number;
  grammage: number;
  quoteAmount?: number;
  createdAt?: string;
  creditFlagged?: boolean;
}

interface DunningWidgetProps {
  paymentsPending: PaymentPending[];
}

/* ─── Countdown Hook ─────────────────────────────────────────── */
function useCountdown(createdAt: string | undefined, windowDays = 3) {
  const [remaining, setRemaining] = useState<{ hours: number; minutes: number; pct: number } | null>(null);

  useEffect(() => {
    if (!createdAt) return;

    function calc() {
      const created = new Date(createdAt!.endsWith('Z') || createdAt!.includes('+') ? createdAt! : createdAt + 'Z').getTime();
      const deadline = created + windowDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const msLeft = deadline - now;
      const totalMs = windowDays * 24 * 60 * 60 * 1000;
      const pct = Math.max(0, Math.min(100, ((totalMs - (deadline - now)) / totalMs) * 100));

      if (msLeft <= 0) {
        setRemaining({ hours: 0, minutes: 0, pct: 100 });
        return;
      }
      const hours = Math.floor(msLeft / 3600000);
      const minutes = Math.floor((msLeft % 3600000) / 60000);
      setRemaining({ hours, minutes, pct });
    }

    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [createdAt, windowDays]);

  return remaining;
}

/* ─── Individual Dunning Card ────────────────────────────────── */
function DunningCard({ item }: { item: PaymentPending }) {
  const countdown = useCountdown(item.createdAt);
  const urgent = countdown && countdown.hours < 24;
  const expired = countdown && countdown.hours === 0 && countdown.minutes === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-colors ${
        expired
          ? 'border-red-500/40 bg-red-500/[0.06]'
          : urgent
          ? 'border-amber-400/40 bg-amber-400/[0.06]'
          : 'border-amber-400/15 bg-amber-400/[0.03]'
      }`}
    >
      {/* Customer Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${expired ? 'text-red-300' : 'text-amber-300'}`}>
              {item.customerName}
            </span>
            {item.creditFlagged && (
              <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                <ShieldAlert className="h-2.5 w-2.5" /> FLAGGED
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{item.customerPhone}</div>
        </div>
        {item.quoteAmount && item.quoteAmount > 0 && (
          <span className="text-xs font-bold text-slate-300">₹{(item.quoteAmount / 1000).toFixed(0)}K</span>
        )}
      </div>

      {/* Order Specs */}
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.sizeInches}"</span>
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.grammage}g</span>
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.quality}</span>
        <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
          {item.quantityKg?.toLocaleString('en-IN')}kg
        </span>
      </div>

      {/* Countdown Timer */}
      {countdown && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <div className={`flex items-center gap-1 ${expired ? 'text-red-400' : urgent ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
              <Clock3 className="h-3 w-3" />
              {expired ? (
                <span className="font-bold">AUTO-CANCEL TRIGGERED</span>
              ) : (
                <span>
                  {countdown.hours}h {countdown.minutes}m until auto-cancel
                </span>
              )}
            </div>
            <span className="text-slate-600">{Math.round(countdown.pct)}% elapsed</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${
                expired ? 'bg-red-500' : urgent ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${countdown.pct}%` }}
            />
          </div>
          {item.creditFlagged && (
            <p className="text-[10px] text-red-400/80 italic mt-1">
              ⚠ Credit-flagged client — 100% advance required on next order per policy §5.1
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export function DunningWidget({ paymentsPending }: DunningWidgetProps) {
  if (paymentsPending.length === 0) return null;

  const urgent = paymentsPending.filter((p) => {
    if (!p.createdAt) return false;
    const created = new Date(p.createdAt.endsWith('Z') ? p.createdAt : p.createdAt + 'Z').getTime();
    const deadline = created + 3 * 24 * 60 * 60 * 1000;
    return deadline - Date.now() < 24 * 60 * 60 * 1000;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl border border-white/10 p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg border ${urgent.length > 0 ? 'bg-amber-400/15 border-amber-400/30' : 'bg-amber-400/10 border-amber-400/20'}`}>
          <AlertTriangle className={`h-4 w-4 ${urgent.length > 0 ? 'text-amber-300 animate-pulse' : 'text-amber-400'}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Token Dunning Monitor</h3>
          <p className="text-xs text-slate-400">
            {paymentsPending.length} pending · {urgent.length > 0 ? `${urgent.length} urgent (< 24h)` : '3-day cancellation window active'}
          </p>
        </div>
        {urgent.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold animate-pulse">
            {urgent.length} URGENT
          </span>
        )}
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {paymentsPending.map((p) => (
          <DunningCard key={p.enquiryId} item={p} />
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-slate-500">
        Auto-cancel runs via the job runner every ~15 min. Day-2 (T12) and Day-3 (T13) reminders sent automatically.
      </div>
    </motion.div>
  );
}

