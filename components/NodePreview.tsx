'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { N8nWorkflow, N8nNode } from '@/lib/n8n-types';

interface NodePreviewProps {
  workflow: N8nWorkflow | null;
}

function getDotColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('trigger') || t.includes('webhook') || t.includes('manual')) {
    return 'bg-blue-400';
  }
  if (
    t.includes('if') ||
    t.includes('switch') ||
    t.includes('code') ||
    t.includes('function') ||
    t.includes('wait')
  ) {
    return 'bg-purple-400';
  }
  return 'bg-emerald-400';
}

export default function NodePreview({ workflow }: NodePreviewProps) {
  const [selectedNode, setSelectedNode] = useState<N8nNode | null>(null);

  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Node Flow Preview (Click node to inspect)
        </span>
      </div>
      <div className="overflow-x-auto pb-1.5 custom-scrollbar">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.04, duration: 0.2 },
            },
          }}
          className="flex items-center gap-1.5 min-w-max py-0.5"
        >
          {workflow.nodes.map((node, i) => {
            const outgoingConnections =
              workflow.connections?.[node.name]?.main?.flat() ?? [];

            return (
              <div key={node.id || node.name} className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <motion.button
                      type="button"
                      variants={{
                        hidden: { opacity: 0, y: 3 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.15 } },
                      }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedNode(node)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2e2e35] bg-[#141416] text-xs text-zinc-300 hover:border-[#FF6D5A]/60 hover:text-white transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-[#FF6D5A]"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotColor(
                          node.type
                        )}`}
                      />
                      <span className="font-medium">{node.name}</span>
                    </motion.button>
                  </PopoverTrigger>

                  <PopoverContent className="w-72 p-3 text-xs" align="start">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between border-b border-[#2e2e35] pb-1.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs">{node.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {node.type}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#27272a] text-zinc-400">
                          v{node.typeVersion || 1}
                        </span>
                      </div>

                      {/* Position & Connections */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Position: [{node.position?.[0]}, {node.position?.[1]}]</span>
                        <span>{outgoingConnections.length} target(s)</span>
                      </div>

                      {/* Outgoing Targets */}
                      {outgoingConnections.length > 0 && (
                        <div className="flex flex-col gap-1 border-t border-[#232328] pt-1.5">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                            Connects To:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {outgoingConnections.map((c, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-[#1f1f23] text-zinc-300 border border-[#2e2e35]"
                              >
                                <ArrowRight className="w-2.5 h-2.5 text-[#FF6D5A]" />
                                <span>{c.node}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parameters snippet */}
                      <div className="flex flex-col gap-1 border-t border-[#232328] pt-1.5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                          Parameters:
                        </span>
                        <pre className="text-[10px] font-mono bg-[#111113] p-1.5 rounded max-h-24 overflow-y-auto text-zinc-300">
                          {JSON.stringify(node.parameters || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {i < workflow.nodes.length - 1 && (
                  <span className="text-zinc-600 text-xs px-0.5 select-none font-mono">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
