'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronRight, Clock3, Package, RefreshCw, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';

/* ─── Types ───────────────────────────────────────────────────── */
interface OrderCard {
  id: string;
  customerName: string;
  length?: number;
  width?: number;
  depth?: number;
  flute?: string;
  print?: string;
  quantity?: number;
  quoteAmount: number;
  status: string;
  deliveryEstimateDays?: number;
  createdAt?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  badgeBg: string;
  icon: React.ReactNode;
  items: OrderCard[];
}

interface KanbanPipelineProps {
  allEnquiries: OrderCard[];
  onConfirmPayment: (enquiryId: string) => void;
  onDispatch?: (orderId: string) => void;
}

/* ─── Dispatch Modal ─────────────────────────────────────────── */
function DispatchModal({ orderId, customerName, onConfirm, onClose }: {
  orderId: string;
  customerName: string;
  onConfirm: (data: { transporter: string; vehicle: string; lr: string }) => void;
  onClose: () => void;
}) {
  const [transporter, setTransporter] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [lr, setLr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!transporter.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, transporterName: transporter, vehicleNo: vehicle, lrNo: lr }),
      });
      if (res.ok) {
        onConfirm({ transporter, vehicle, lr });
      } else {
        alert('Dispatch failed. Check server logs.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="relative w-[420px] rounded-2xl border border-white/15 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10">
            <Truck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Mark as Dispatched</h3>
            <p className="text-xs text-slate-400">{customerName}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Transporter Name *</label>
            <input
              value={transporter}
              onChange={(e) => setTransporter(e.target.value)}
              placeholder="e.g. FedEx"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tracking No.</label>
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g. 123456789"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60 placeholder:text-slate-600"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSubmit}
            disabled={!transporter.trim() || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            Confirm Dispatch
          </button>
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 text-sm text-slate-400 hover:text-white transition">
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Order Card ─────────────────────────────────────────────── */
function KanbanCard({
  item,
  index,
  colId,
  onConfirmPayment,
  onDispatch,
}: {
  item: OrderCard;
  index: number;
  colId: string;
  onConfirmPayment: (id: string) => void;
  onDispatch: (id: string, name: string) => void;
}) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`select-none rounded-xl border p-3 mb-2 transition-shadow ${
            snapshot.isDragging
              ? 'border-accent bg-panel shadow-2xl shadow-accent/20 rotate-1 scale-[1.02]'
              : 'border-white/[0.06] bg-black/30 hover:border-white/15'
          }`}
        >
          {/* Customer + Amount */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-200 leading-tight">{item.customerName}</span>
            {item.quoteAmount > 0 && (
              <span className="shrink-0 text-[10px] font-bold text-slate-300">
                ₹{(item.quoteAmount / 1000).toFixed(0)}K
              </span>
            )}
          </div>

          {/* Spec Tags */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {item.length && item.width && item.depth && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                {item.length}x{item.width}x{item.depth}"
              </span>
            )}
            {item.flute && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.flute}</span>
            )}
            {item.print && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-slate-400">{item.print}</span>
            )}
            {item.quantity && (
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                {item.quantity.toLocaleString('en-IN')} pcs
              </span>
            )}
          </div>

          {/* Progress bar for in-production */}
          {colId === 'in_production' && item.deliveryEstimateDays && (
            <div className="mb-2.5">
              <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                <span>In Progress</span>
                <span>~{item.deliveryEstimateDays}d left</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 animate-[shimmer_3s_infinite]" style={{ width: '45%' }} />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {colId === 'awaiting_payment' && (
            <button
              onClick={() => onConfirmPayment(item.id)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
            >
              <Check className="h-3 w-3" /> Confirm Payment
            </button>
          )}
          {colId === 'in_production' && (
            <button
              onClick={() => onDispatch(item.id, item.customerName)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/20"
            >
              <Truck className="h-3 w-3" /> Mark Dispatched
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
}

/* ─── Main Kanban Board ───────────────────────────────────────── */
export function KanbanPipeline({ allEnquiries, onConfirmPayment, onDispatch }: KanbanPipelineProps) {
  const [dispatchModal, setDispatchModal] = useState<{ id: string; name: string } | null>(null);

  const cols: KanbanColumn[] = [
    {
      id: 'awaiting_payment',
      title: 'Awaiting Payment',
      colorClass: 'text-amber-400',
      bgClass: 'bg-amber-400/[0.04]',
      borderClass: 'border-amber-400/15',
      badgeBg: 'bg-amber-400/20 text-amber-400',
      icon: <Clock3 className="h-3.5 w-3.5" />,
      items: allEnquiries.filter((o) => o.status === 'awaiting_payment'),
    },
    {
      id: 'in_production',
      title: 'In Production',
      colorClass: 'text-cyan',
      bgClass: 'bg-cyan/[0.04]',
      borderClass: 'border-cyan/15',
      badgeBg: 'bg-cyan/20 text-cyan',
      icon: <Package className="h-3.5 w-3.5" />,
      items: allEnquiries.filter((o) => o.status === 'in_production'),
    },
    {
      id: 'dispatched',
      title: 'Dispatched',
      colorClass: 'text-violet-400',
      bgClass: 'bg-violet-400/[0.04]',
      borderClass: 'border-violet-400/15',
      badgeBg: 'bg-violet-400/20 text-violet-400',
      icon: <Truck className="h-3.5 w-3.5" />,
      items: allEnquiries.filter((o) => o.status === 'dispatched' || o.status === 'ready_dispatch'),
    },
    {
      id: 'complete',
      title: 'Completed',
      colorClass: 'text-emerald-400',
      bgClass: 'bg-emerald-400/[0.04]',
      borderClass: 'border-emerald-400/15',
      badgeBg: 'bg-emerald-400/20 text-emerald-400',
      icon: <Check className="h-3.5 w-3.5" />,
      items: allEnquiries.filter((o) => o.status === 'complete' || o.status === 'delivered'),
    },
  ];

  function handleDragEnd(result: DropResult) {
    // Optimistic UI: for now, just show payment / dispatch modal on relevant drops
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const destCol = destination.droppableId;
    const srcCard = allEnquiries.find((o) => o.id === draggableId);
    if (!srcCard) return;

    if (destCol === 'awaiting_payment' && source.droppableId === 'in_production') return; // invalid move
    if (destCol === 'dispatched') {
      setDispatchModal({ id: draggableId, name: srcCard.customerName });
    }
    if (destCol === 'awaiting_payment' && source.droppableId === 'in_production') return;
    if (destCol === 'in_production' && source.droppableId === 'awaiting_payment') {
      if (confirm(`Confirm token payment received for ${srcCard.customerName}? This will send a WhatsApp notification.`)) {
        onConfirmPayment(draggableId);
      }
    }
  }

  return (
    <>
      <div className="glass rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan/10 rounded-lg border border-cyan/20">
            <ChevronRight className="h-4 w-4 text-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Orders Pipeline</h3>
            <p className="text-xs text-slate-400">{allEnquiries.length} orders · Drag to update status</p>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cols.map((col) => (
              <div key={col.id} className={`rounded-xl border p-3 ${col.bgClass} ${col.borderClass}`}>
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${col.colorClass}`}>
                    {col.icon}
                    {col.title}
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${col.badgeBg}`}>
                    {col.items.length}
                  </span>
                </div>

                {/* Droppable List */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[60px] rounded-lg transition-colors ${
                        snapshot.isDraggingOver ? 'bg-white/[0.04]' : ''
                      }`}
                    >
                      {col.items.slice(0, 8).map((item, index) => (
                        <KanbanCard
                          key={item.id}
                          item={item}
                          index={index}
                          colId={col.id}
                          onConfirmPayment={onConfirmPayment}
                          onDispatch={(id, name) => setDispatchModal({ id, name })}
                        />
                      ))}
                      {provided.placeholder}
                      {col.items.length === 0 && (
                        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-white/[0.06] text-[10px] text-slate-600">
                          No orders
                        </div>
                      )}
                      {col.items.length > 8 && (
                        <div className="text-center py-1 text-[10px] text-slate-500">
                          +{col.items.length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      <AnimatePresence>
        {dispatchModal && (
          <DispatchModal
            orderId={dispatchModal.id}
            customerName={dispatchModal.name}
            onConfirm={() => {
              setDispatchModal(null);
              alert('✅ Order dispatched! Customer notified via WhatsApp (T20).');
            }}
            onClose={() => setDispatchModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

