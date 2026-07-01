"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, CornerDownLeft } from "lucide-react";

import { navItems, type ViewKey } from "@/lib/data";
import { SALES_OS_AREAS } from "@/lib/vision-os/areas";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

/**
 * ⌘ Command Palette — the global action/search layer for Vision OS.
 *
 * Open with Ctrl/Cmd-K (or "/"). Lets the owner jump to any area/view or any
 * customer without navigating. Designed as a shell-level primitive: future
 * modules contribute commands via their manifest (VisionModule.commands).
 *
 * Mounted once at the shell root (page.tsx, flag-gated). Dependency-free.
 */
type Command = {
  id: string;
  title: string;
  group: string;
  keywords: string;
  run: () => void;
};

type CustomerHit = { id: string; name?: string; company?: string; phone?: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const setActiveCustomerId = useUIStore((s) => s.setActiveCustomerId);

  // Toggle on Ctrl/Cmd-K; close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Customer search (only when typing) — reuses the existing customers API.
  const { data: custData } = useQuery<{ ok?: boolean; customers?: CustomerHit[] }>({
    queryKey: ["cmd-customers", query],
    queryFn: () => fetch(`/api/customers?search=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => ({})),
    enabled: open && query.trim().length >= 2,
  });

  const commands: Command[] = useMemo(() => {
    const navCmds: Command[] = SALES_OS_AREAS.map((a) => ({
      id: `area-${a.key}`,
      title: `Go to ${a.label}`,
      group: "Navigate",
      keywords: `${a.label} ${a.description ?? ""}`,
      run: () => setActiveView(a.defaultView),
    }));
    const viewCmds: Command[] = navItems.map((n) => ({
      id: `view-${n.key}`,
      title: `Open ${n.label}`,
      group: "Navigate",
      keywords: n.label,
      run: () => setActiveView(n.key as ViewKey),
    }));
    const custCmds: Command[] = (custData?.customers || []).slice(0, 6).map((c) => ({
      id: `cust-${c.id}`,
      title: c.company || c.name || c.phone || "Customer",
      group: "Customers",
      keywords: `${c.company ?? ""} ${c.name ?? ""} ${c.phone ?? ""}`,
      run: () => setActiveCustomerId(c.id),
    }));
    return [...custCmds, ...navCmds, ...viewCmds];
  }, [custData, setActiveView, setActiveCustomerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.title} ${c.keywords}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0);
  }, [filtered.length, cursor]);

  if (!open) return null;

  function exec(cmd?: Command) {
    if (!cmd) return;
    cmd.run();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        className="glass-strong w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); exec(filtered[cursor]); }
            }}
            placeholder="Search customers, jump to any screen…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 && <div className="py-8 text-center text-xs text-slate-500">No results</div>}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(cmd)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition",
                i === cursor ? "bg-cyan/10 text-white" : "text-slate-300 hover:bg-white/[0.04]",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-2 text-[10px] uppercase text-slate-500">{cmd.group}</span>
                {cmd.title}
              </span>
              {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-cyan" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

