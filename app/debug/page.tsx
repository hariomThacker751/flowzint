"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RefreshCw, CircleCheck, CircleX, AlertTriangle, Database, MessageCircle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

export default function DebugPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DebugDashboard />
    </QueryClientProvider>
  );
}

function DebugDashboard() {
  const { data, isLoading, refetch, isFetching, error, isError } = useQuery({
    queryKey: ["debug-webhooks"],
    queryFn: () => fetch("/api/debug/webhooks").then(async (r) => {
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned status ${r.status}`);
      }
      return r.json();
    }),
    refetchInterval: 5000,
  });

  const debug = data?.debug;
  const isApiError = data && data.ok === false;
  const displayError = error instanceof Error ? error.message : isApiError ? data.error : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Webhook Debug Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Monitor ChakraHQ webhooks and system status</p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        )}

        {(isError || isApiError) && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 mb-6">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Failed to load debug status</h2>
            </div>
            <p className="text-sm text-red-300">{displayError}</p>
          </div>
        )}

        {!isLoading && debug && (
          <div className="space-y-6">
            {/* Environment Status */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CircleCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-semibold">Environment Configuration</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <StatusCard
                  label="ChakraHQ API"
                  status={debug.environment.chakraConfigured}
                />
                <StatusCard
                  label="Sarvam AI"
                  status={debug.environment.sarvamConfigured}
                />
                <StatusCard
                  label="Owner Phone"
                  status={debug.environment.ownerPhone !== "not set"}
                  value={debug.environment.ownerPhone}
                />
                <StatusCard
                  label="Webhook Secret"
                  status={debug.environment.webhookSecret === "***set***"}
                  value={debug.environment.webhookSecret}
                />
              </div>
            </div>

            {/* Agent State */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-400" />
                <h2 className="text-xl font-semibold">Agent Runtime State</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <StatusCard
                  label="Agent Enabled"
                  status={debug.agentState.agentEnabled}
                />
                <StatusCard
                  label="Ravi Enabled"
                  status={debug.agentState.raviEnabled}
                />
                <StatusCard
                  label="Auto Send Replies"
                  status={debug.agentState.autoSendRaviReplies}
                />
                <StatusCard
                  label="Outbound Sales"
                  status={debug.agentState.outboundSalesEnabled}
                />
              </div>
              {debug.agentState.updatedAt && (
                <p className="mt-3 text-xs text-slate-500">
                  Last updated: {new Date(debug.agentState.updatedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Webhook Simulator */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-cyan-400" />
                <h2 className="text-xl font-semibold">Simulate Inbound Message</h2>
              </div>
              <SimulationForm onSimulated={() => refetch()} />
            </div>

            {/* Customers */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-400" />
                <h2 className="text-xl font-semibold">Customers ({debug.customers.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700">
                    <tr>
                      <th className="pb-2 text-left font-semibold text-slate-300">Phone</th>
                      <th className="pb-2 text-left font-semibold text-slate-300">Name</th>
                      <th className="pb-2 text-left font-semibold text-slate-300">Company</th>
                      <th className="pb-2 text-left font-semibold text-slate-300">Stage</th>
                      <th className="pb-2 text-right font-semibold text-slate-300">Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {debug.customers.map((customer: any) => (
                      <tr key={customer.id} className="hover:bg-slate-700/30">
                        <td className="py-2 text-slate-300">{customer.phone}</td>
                        <td className="py-2 text-slate-200">{customer.name}</td>
                        <td className="py-2 text-slate-200">{customer.company || "-"}</td>
                        <td className="py-2">
                          <Badge
                            tone={
                              customer.stage === "quoted" ? "violet" :
                              customer.stage === "confirmed" ? "green" :
                              customer.stage === "greeting" ? "cyan" : "slate"
                            }
                          >
                            {customer.stage}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <span className="text-slate-400">
                            {customer.total_messages} total
                            {" "}({customer.user_messages} user, {customer.ai_messages} AI)
                          </span>
                        </td>
                      </tr>
                    ))}
                    {debug.customers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No customers yet. Send a WhatsApp message to the business number to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Messages */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-semibold">Recent Messages ({debug.recentMessages.length})</h2>
              </div>
              <div className="space-y-3">
                {debug.recentMessages.slice(0, 10).map((msg: any) => (
                  <div key={msg.id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">
                          {msg.customer_name} ({msg.customer_phone})
                        </span>
                        <Badge tone={msg.role === "user" ? "cyan" : msg.role === "assistant" ? "violet" : "slate"}>
                          {msg.role}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{msg.content}</p>
                  </div>
                ))}
                {debug.recentMessages.length === 0 && (
                  <p className="py-8 text-center text-slate-500">
                    No messages yet. Start a conversation via WhatsApp!
                  </p>
                )}
              </div>
            </div>

            {/* Webhook Log */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-semibold">Webhook Events ({debug.webhookLog.length})</h2>
              </div>
              <div className="space-y-3">
                {debug.webhookLog.map((event: any) => (
                  <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge
                        tone={
                          event.type === "ravi_processed" ? "green" :
                          event.type === "customer_inbound" ? "cyan" :
                          event.type.includes("error") ? "red" : "amber"
                        }
                      >
                        {event.type}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <pre className="overflow-x-auto text-xs text-slate-400">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                ))}
                {debug.webhookLog.length === 0 && (
                  <p className="py-8 text-center text-slate-500">
                    No webhook events logged yet. Send a message to trigger webhooks.
                  </p>
                )}
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-center text-xs text-slate-500">
              Last updated: {new Date(debug.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusCard({ label, status, value }: { label: string; status: boolean; value?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {status ? (
          <CircleCheck className="h-4 w-4 text-emerald-400" />
        ) : (
          <CircleX className="h-4 w-4 text-red-400" />
        )}
      </div>
      {value && (
        <p className="text-sm text-slate-200">{value}</p>
      )}
      {!value && (
        <p className={`text-sm font-semibold ${status ? "text-emerald-400" : "text-red-400"}`}>
          {status ? "Configured" : "Not Set"}
        </p>
      )}
    </div>
  );
}

function SimulationForm({ onSimulated }: { onSimulated: () => void }) {
  const [type, setType] = useState<"customer" | "owner">("customer");
  const [phone, setPhone] = useState("919408724777");
  const [name, setName] = useState("Hariom Thacker");
  const [text, setText] = useState("hi");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/test/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, phone, name, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to simulate message");
      }
      setResult(data.result);
      onSimulated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 font-semibold">Sender Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="customer">Customer (Ravi AI)</option>
            <option value="owner">Owner (Director AI)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 font-semibold">Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="e.g. 919408724777"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 font-semibold">Sender Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="Name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 font-semibold">Message Text</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="e.g. hi"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading ? "Simulating..." : "Send Simulation Webhook"}
        </Button>
      </div>

      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 mt-3">
          <p className="text-xs font-bold text-emerald-400 mb-1">Simulation Successful</p>
          <p className="text-sm text-slate-200">
            <strong>Status:</strong> {result.status || "processed"}<br />
            <strong>AI Response:</strong> {result.response || result.reply || "(no text response)"}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mt-3">
          <p className="text-xs font-bold text-red-400 mb-1">Simulation Failed</p>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </form>
  );
}


