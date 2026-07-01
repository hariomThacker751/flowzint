'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Escalation {
  id: string;
  customerName: string;
  customerPhone: string;
  question: string;
  holdingMessage: string;
  createdAt: string;
}

interface PaymentPending {
  enquiryId: string;
  customerName: string;
  customerPhone: string;
  quantityKg: number;
  quality: string;
  sizeInches: number;
  grammage: number;
  createdAt: string;
}

interface AttentionBarProps {
  escalations: Escalation[];
  paymentsPending: PaymentPending[];
  onReplyEscalation: (escalationId: string, reply: string) => Promise<void>;
  onDismissEscalation: (escalationId: string) => Promise<void>;
  onConfirmPayment: (enquiryId: string) => Promise<void>;
  loading?: boolean;
}

export function AttentionBar({
  escalations,
  paymentsPending,
  onReplyEscalation,
  onDismissEscalation,
  onConfirmPayment,
  loading,
}: AttentionBarProps) {
  const [expanded, setExpanded] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const totalItems = escalations.length + paymentsPending.length;
  if (totalItems === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-red-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="text-left">
            <h2 className="text-lg font-bold text-red-800">
              Attention Needed ({totalItems})
            </h2>
            <p className="text-sm text-red-600">
              {escalations.length > 0 && `${escalations.length} customer question${escalations.length > 1 ? 's' : ''}`}
              {escalations.length > 0 && paymentsPending.length > 0 && ' · '}
              {paymentsPending.length > 0 && `${paymentsPending.length} payment${paymentsPending.length > 1 ? 's' : ''} to confirm`}
            </p>
          </div>
        </div>
        <span className="text-red-400 text-sm font-medium">
          {expanded ? 'Collapse ▲' : 'Expand ▼'}
        </span>
      </button>

      {/* Items */}
      {expanded && (
        <div className="px-6 pb-4 space-y-3">
          {/* Escalations: Customer Questions */}
          {escalations.map((esc) => (
            <div
              key={esc.id}
              className="bg-white rounded-lg border border-red-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {esc.customerName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {esc.customerPhone}
                    </span>
                    <span className="text-xs text-gray-400">
                      · {timeAgo(esc.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-2">
                    💬 &ldquo;{esc.question}&rdquo;
                  </p>
                  {esc.holdingMessage && (
                    <p className="text-xs text-gray-400 italic">
                      AI replied: &ldquo;{esc.holdingMessage.slice(0, 120)}...&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => onDismissEscalation(esc.id)}
                    disabled={loading}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border-0"
                  >
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => setReplyingTo(replyingTo === esc.id ? null : esc.id)}
                    disabled={loading}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    {replyingTo === esc.id ? 'Cancel' : 'Reply'}
                  </Button>
                </div>
              </div>

              {/* Inline Reply Box */}
              {replyingTo === esc.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <textarea
                    value={replyText[esc.id] || ''}
                    onChange={(e) =>
                      setReplyText((prev) => ({ ...prev, [esc.id]: e.target.value }))
                    }
                    placeholder="Type your reply to the customer..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <Button
                      onClick={async () => {
                        if (replyText[esc.id]?.trim()) {
                          await onReplyEscalation(esc.id, replyText[esc.id].trim());
                          setReplyText((prev) => ({ ...prev, [esc.id]: '' }));
                          setReplyingTo(null);
                        }
                      }}
                      disabled={loading || !replyText[esc.id]?.trim()}
                      className="text-xs bg-green-600 hover:bg-green-700"
                    >
                      Send Reply via WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Payments Pending */}
          {paymentsPending.map((pp) => (
            <div
              key={pp.enquiryId}
              className="bg-white rounded-lg border border-amber-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {pp.customerName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {pp.customerPhone}
                    </span>
                    <span className="text-xs text-gray-400">
                      · {timeAgo(pp.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    💰 {pp.quantityKg}kg · {pp.sizeInches}&quot; · {pp.grammage}g · {pp.quality || 'Standard'}
                  </p>
                </div>
                <Button
                  onClick={() => onConfirmPayment(pp.enquiryId)}
                  disabled={loading}
                  className="text-sm bg-green-600 hover:bg-green-700 shrink-0"
                >
                  ✓ Confirm Payment
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseDate(dateStr: string): number {
  // Handle mixed formats: "2026-06-14T07:56:50.355Z" or "2026-06-14 05:35:40"
  const s = dateStr.trim();
  // If it already ends with Z or contains a timezone offset, parse directly
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s).getTime();
  }
  // SQLite datetime format without timezone — treat as UTC
  return new Date(s + 'Z').getTime();
}

function timeAgo(dateStr: string): string {
  const ts = parseDate(dateStr);
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

