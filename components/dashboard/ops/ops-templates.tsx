"use client";

/**
 * Template Studio — manage the DB-backed, versioned WhatsApp template store
 * (Phase 4). View the 31 templates × 8 native languages, preview the rendered
 * native body, edit (versioned), set Meta approval status, and map ChakraHQ
 * template names. Owner edits via POST /api/admin/templates.
 */

import { useEffect, useState } from "react";
import { FileText, Eye, Save, Languages, BadgeCheck } from "lucide-react";
import { Card, Empty, Pill, Stat, useJson, cls } from "./ops-shared";

const LANGS = ["English", "Hindi", "Gujarati", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi"];

type Variant = { language: string; version: number; approval_status: string; chakra_template_name: string | null };
type Tpl = { id: string; name: string; category: string; requiredVars: string[]; version: number; variants: Variant[] };

export default function OpsTemplates() {
  const { data, refetch } = useJson<{ templates: Tpl[]; variableSetIssues: any[] }>("ops-tpls", "/api/admin/templates", 0);
  const templates = data?.templates ?? [];
  const [sel, setSel] = useState<string>("T1");
  const [lang, setLang] = useState<string>("Gujarati");
  const [preview, setPreview] = useState<{ text: string; language: string; missingRequiredVars?: string[] } | null>(null);
  const [body, setBody] = useState("");
  const [chakraName, setChakraName] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const current = templates.find((t) => t.id === sel);
  const variant = current?.variants.find((v) => v.language === lang);

  useEffect(() => {
    if (variant) { setChakraName(variant.chakra_template_name || ""); setStatus(variant.approval_status || "draft"); }
    let cancelled = false;
    fetch(`/api/templates/registry?id=${sel}&lang=${lang}`, { credentials: "include" })
      .then((r) => r.json()).then((d) => { if (!cancelled) { setPreview(d); setBody(d.text || ""); } }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, lang, data]);

  async function save(fields: { body?: string; approvalStatus?: string; chakraName?: string }) {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sel, language: lang, ...fields }),
      });
      const d = await res.json();
      setMsg(res.ok ? `Saved: ${d.changed?.join(", ")}` : (d.error || "failed (owner only)"));
      refetch();
    } catch { setMsg("network error"); } finally { setSaving(false); }
  }

  const approvedCount = templates.reduce((n, t) => n + t.variants.filter((v) => v.approval_status === "approved").length, 0);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Templates" value={templates.length} tone="cyan" />
        <Stat label="Languages" value={8} tone="violet" />
        <Stat label="Approved variants" value={approvedCount} tone="green" sub="ready for outbound" />
        <Stat label="Variable-set issues" value={data?.variableSetIssues?.length ?? 0} tone={(data?.variableSetIssues?.length ?? 0) ? "amber" : "green"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card title="Templates" icon={<FileText className="h-4 w-4 text-cyan" />}>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setSel(t.id)}
                className={cls("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                  sel === t.id ? "border-cyan/30 bg-cyan/10 text-white" : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white")}>
                <span className="truncate"><span className="font-mono text-xs text-slate-500">{t.id}</span> {t.name}</span>
                <span className="text-[10px] text-slate-500">{t.variants.filter((v) => v.approval_status === "approved").length}/8</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={current ? `${current.id} · ${current.name}` : "Select a template"} icon={<Languages className="h-4 w-4 text-cyan" />}
            right={<div className="flex flex-wrap gap-1">{LANGS.map((l) => (
              <button key={l} onClick={() => setLang(l)} className={cls("rounded-md border px-2 py-0.5 text-[10px] transition",
                lang === l ? "border-cyan/40 bg-cyan/15 text-cyan" : "border-white/10 text-slate-400 hover:text-white")}>{l.slice(0, 3)}</button>
            ))}</div>}>
            {!current ? <Empty>Pick a template.</Empty> : (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                  <span>Required vars:</span>
                  {current.requiredVars.length ? current.requiredVars.map((v) => <span key={v} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{v}</span>) : <span className="text-slate-600">none</span>}
                </div>
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <Eye className="h-3.5 w-3.5 text-cyan" /><span className="text-slate-400">Native preview ({preview?.language || lang})</span>
                  {variant && <Pill label={variant.approval_status} />}
                  {variant && <span className="text-slate-500">v{variant.version}</span>}
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7}
                  className="w-full whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200" />
                {preview?.missingRequiredVars && preview.missingRequiredVars.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-400">Preview missing required: {preview.missingRequiredVars.join(", ")}</div>
                )}
                <button onClick={() => save({ body })} disabled={saving}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition hover:bg-cyan/20 disabled:opacity-50">
                  <Save className="h-3.5 w-3.5" /> Save body (new version)
                </button>
              </>
            )}
          </Card>

          <Card title="Meta approval & ChakraHQ mapping" icon={<BadgeCheck className="h-4 w-4 text-cyan" />}>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-400">Approval status
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200">
                  {["draft", "submitted", "approved", "rejected"].map((s) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </label>
              <label className="flex-1 text-xs text-slate-400">ChakraHQ template name
                <input value={chakraName} onChange={(e) => setChakraName(e.target.value)} placeholder="e.g. anjani_t11_gu"
                  className="mt-1 block w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200" />
              </label>
              <button onClick={() => save({ approvalStatus: status, chakraName })} disabled={saving}
                className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition hover:bg-cyan/20 disabled:opacity-50">Apply</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Once a variant is <span className="text-emerald-300">approved</span> with a ChakraHQ name, outbound/outside-24h sends use the Meta template API; otherwise native session text is used.</p>
            {msg && <div className="mt-2 text-xs text-slate-300">{msg}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

