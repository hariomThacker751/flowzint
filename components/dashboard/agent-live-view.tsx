'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Cpu, Zap, Brain, Database, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type AgentThought = {
  id: string;
  timestamp: number;
  intent: 'sales' | 'support' | 'care';
  extractedSpecs?: any;
  action: string;
};

export function AgentLiveView() {
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);

  useEffect(() => {
    // In a real implementation, this would connect to a WebSocket or SSE endpoint.
    // For the hackathon demo, we'll simulate the agent's thought process.
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newThought: AgentThought = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          intent: Math.random() > 0.5 ? 'sales' : 'support',
          action: 'Classified intent, routed to specialist.',
          extractedSpecs: Math.random() > 0.5 ? { length: 12, width: 8, depth: 4 } : undefined
        };
        setThoughts(prev => [newThought, ...prev].slice(0, 5));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass rounded-xl border border-white/10 p-5 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-accent/10 rounded-lg border border-accent/20">
          <Brain className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Agent OS Live</h3>
          <p className="text-xs text-slate-400">Real-time thought visualizer</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest">Listening</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09090b] z-10 pointer-events-none" />
        <AnimatePresence>
          {thoughts.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500 text-xs">
              Waiting for incoming messages...
            </div>
          ) : (
            <div className="space-y-3">
              {thoughts.map((thought) => (
                <motion.div
                  key={thought.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-lg border border-white/5 bg-black/40 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(thought.timestamp).toISOString().split('T')[1].slice(0, -1)}
                      </span>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      thought.intent === 'sales' ? 'bg-accent/20 text-accent' :
                      thought.intent === 'support' ? 'bg-amber-400/20 text-amber-400' :
                      'bg-emerald-400/20 text-emerald-400'
                    }`}>
                      {thought.intent}
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-300 mb-2">
                    {thought.action}
                  </div>

                  {thought.extractedSpecs && (
                    <div className="bg-black/60 rounded border border-white/5 p-2 font-mono text-[10px] text-emerald-300">
                      <div className="text-slate-500 mb-1 flex items-center gap-1">
                        <Database className="h-3 w-3" /> Extracted Entities:
                      </div>
                      {JSON.stringify(thought.extractedSpecs, null, 2)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

