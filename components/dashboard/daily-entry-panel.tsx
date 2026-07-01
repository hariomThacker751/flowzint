'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Check, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

/* ─── Types ────────────────────────────────────────────────────── */
interface ActiveBatch {
  id?: string;
  orderId?: string;
  customerName: string;
  specs?: string;
  kgBooked: number;
  progressPct?: number;
  deliveryEstimateDays?: number;
}

interface DailyEntryPanelProps {
  activeBatches: ActiveBatch[];
  onRefresh: () => void;
}

/* ─── Component ─────────────────────────────────────────────── */
export function DailyEntryPanel({ activeBatches, onRefresh }: DailyEntryPanelProps) {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  async function submitDailyKg() {
    const payload = Object.entries(entries)
      .filter(([, kg]) => kg.trim() && !isNaN(Number(kg)))
      .map(([orderId, kg]) => ({ orderId, actualKgToday: Number(kg) }));

    if (payload.length === 0) {
      setStatus({ type: 'err', msg: 'Enter at least one KG value.' });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      // Submit each entry individually to /api/production/daily
      const results = await Promise.all(
        payload.map((item) =>
          fetch('/api/production/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: item.orderId, actualKgToday: item.actualKgToday }),
          }).then((r) => r.json())
        )
      );
      const allOk = results.every((r) => r.ok !== false);
      if (allOk) {
        setStatus({ type: 'ok', msg: `✅ Daily production logged for ${payload.length} order(s). ETAs recalculated.` });
        setEntries({});
        onRefresh();
      } else {
        setStatus({ type: 'err', msg: '⚠️ Some entries failed. Check server logs.' });
      }
    } catch {
      setStatus({ type: 'err', msg: '❌ Network error. Please retry.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setStatus(null), 5000);
    }
  }

  async function handleSheetUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/production/import-sheet', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        setStatus({ type: 'ok', msg: `✅ Sheet imported: ${data.rowsProcessed || 'N'} rows processed. ETAs updated.` });
        onRefresh();
      } else {
        setStatus({ type: 'err', msg: `❌ Import failed: ${data.error || 'Unknown error'}` });
      }
    } catch {
      setStatus({ type: 'err', msg: '❌ Upload failed. Ensure file is .xlsx format.' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setStatus(null), 8000);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl border border-white/10 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-400/10 rounded-lg border border-violet-400/20">
            <FileSpreadsheet className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Daily Production Log</h3>
            <p className="text-xs text-slate-400">{today} · Enter actual KG produced per order</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadMode(!uploadMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
              uploadMode
                ? 'border-violet-400/40 bg-violet-400/15 text-violet-300'
                : 'border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="h-3 w-3" /> Sheet Import
          </button>
        </div>
      </div>

      {/* Sheet Upload Mode */}
      {uploadMode && (
        <div className="mb-4 rounded-xl border border-dashed border-violet-400/30 bg-violet-400/[0.04] p-4 text-center">
          <Upload className="mx-auto mb-2 h-6 w-6 text-violet-400/60" />
          <p className="text-xs text-slate-400 mb-3">Upload your daily production .xlsx from Google Sheets export</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleSheetUpload} className="hidden" id="sheet-upload" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/25 disabled:opacity-50"
          >
            {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? 'Importing...' : 'Select .xlsx File'}
          </button>
        </div>
      )}

      {/* Manual Entry Grid */}
      {!uploadMode && (
        <>
          {activeBatches.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <Check className="mx-auto mb-2 h-8 w-8 text-emerald-400/40" />
              <p className="text-sm">No active production batches</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4 max-h-[320px] overflow-y-auto">
              {activeBatches.map((batch, i) => {
                const key = batch.orderId || batch.id || String(i);
                return (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/30 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-200 truncate">{batch.customerName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {batch.specs || ''}{batch.kgBooked ? ` · ${batch.kgBooked}kg total` : ''}
                      </div>
                      {/* Mini progress bar */}
                      {batch.progressPct !== undefined && (
                        <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald-400"
                            style={{ width: `${Math.min(batch.progressPct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={batch.kgBooked || 10000}
                        step={10}
                        value={entries[key] || ''}
                        onChange={(e) => setEntries((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="KG"
                        className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm text-slate-100 outline-none focus:border-cyan/60 placeholder:text-slate-600"
                      />
                      <span className="text-[10px] text-slate-500">kg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeBatches.length > 0 && (
            <button
              onClick={submitDailyKg}
              disabled={submitting || Object.keys(entries).length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 py-2.5 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? 'Logging & Recalculating ETAs...' : 'Submit Daily Production Log'}
            </button>
          )}
        </>
      )}

      {/* Status Toast */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 rounded-lg border px-4 py-2.5 text-xs leading-5 ${
            status.type === 'ok'
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border-red-400/30 bg-red-400/10 text-red-300'
          }`}
        >
          {status.msg}
        </motion.div>
      )}
    </motion.div>
  );
}

