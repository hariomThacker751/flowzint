"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useShellStore } from "@/lib/vision-os/shell-store";
import { ApprovalQueue } from "./approval-queue";

/**
 * 🔔 Approval Tray — the persistent, global approval layer accessible from
 * anywhere via the top-bar bell. It wraps the single <ApprovalQueue> so the
 * same approvals surface is reused (no duplication). Mounted once at the shell
 * root (page.tsx), flag-gated.
 */
export function ApprovalTray() {
  const open = useShellStore((s) => s.trayOpen);
  const setOpen = useShellStore((s) => s.setTrayOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-end bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="glass-strong h-full w-full max-w-md overflow-y-auto border-l border-white/10 p-4"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ type: "tween", duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Approval Tray</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ApprovalQueue limit={50} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

