"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Phone, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGE_META, type BoardOrder } from "@/lib/vision-os/lifecycle";

/**
 * <OrderDrawer> — one side panel showing a full order anywhere it is clicked,
 * replacing the need to open separate quote / payment / dispatch pages. Actions
 * reuse existing, proven endpoints (no business logic change).
 */
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-200">{value ?? "—"}</span>
    </div>
  );
}

export function OrderDrawer({ order, onClose }: { order: BoardOrder | null; onClose: () => void }) {
  const qc = useQueryClient();

  async function confirmPayment() {
    if (!order) return;
    if (!confirm("Confirm advance token payment received? The customer will be notified on WhatsApp.")) return;
    const r = await fetch("/api/orders/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ enquiryId: order.id }),
    });
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["orders-board"] });
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      qc.invalidateQueries({ queryKey: ["vision-metrics"] });
      onClose();
    } else {
      alert("Failed to confirm payment");
    }
  }

  const stage = order ? STAGE_META[order.stage] : null;

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          className="fixed inset-0 z-[80] flex justify-end bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-strong h-full w-full max-w-md overflow-y-auto border-l border-white/10 p-5"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ type: "tween", duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-white">{order.customerName}</div>
                {order.customerPhone && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Phone className="h-3 w-3" /> {order.customerPhone}
                  </div>
                )}
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {stage && <Badge tone={stage.tone}>{stage.label}</Badge>}

            <div className="mt-4">
              <Row label="Order No." value={order.orderNo} />
              <Row label="Specification" value={order.spec} />
              <Row label="Quantity" value={order.quantityKg ? `${order.quantityKg} kg` : undefined} />
              <Row label="Delivery City" value={order.deliveryCity} />
              <Row label="Quote Amount" value={order.amount ? `₹${order.amount.toLocaleString("en-IN")}` : undefined} />
              <Row label="Owner Approved" value={order.ownerApproved ? "Yes" : "No"} />
              <Row label="Raw Status" value={order.status} />
            </div>

            {order.stage === "token_pending" && (
              <Button onClick={confirmPayment} className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700">
                <Check className="mr-1.5 h-4 w-4" /> Confirm Token Payment
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

