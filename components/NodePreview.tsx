'use client';

import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Info, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { N8nWorkflow, N8nNode } from '@/lib/n8n-types';

interface NodePreviewProps {
  workflow: N8nWorkflow | null;
}

function getDotColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('trigger') || t.includes('webhook') || t.includes('manual') || t.includes('schedule')) {
    return 'bg-[#02F7C8] shadow-[0_0_6px_rgba(2,247,200,0.7)]';
  }
  if (
    t.includes('if') ||
    t.includes('switch') ||
    t.includes('code') ||
    t.includes('function') ||
    t.includes('wait')
  ) {
    return 'bg-[#7501FD] shadow-[0_0_6px_rgba(117,1,253,0.7)]';
  }
  return 'bg-[#01B6FE] shadow-[0_0_6px_rgba(1,182,254,0.7)]';
}

function NodePreview({ workflow }: NodePreviewProps) {
  const [selectedNode, setSelectedNode] = useState<N8nNode | null>(null);

  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 [transform:translateZ(0)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Node Flow Preview (Click node to inspect)
        </span>
      </div>
      <div className="overflow-x-auto pb-1.5 custom-scrollbar smooth-scroll-momentum [contain:paint]">
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
          className="flex items-center gap-2 min-w-max py-0.5"
        >
          {workflow.nodes.map((node, i) => {
            const outgoingConnections =
              workflow.connections?.[node.name]?.main?.flat() ?? [];

            return (
              <div key={node.id || node.name} className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <motion.button
                      type="button"
                      variants={{
                        hidden: { opacity: 0, y: 3 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.15 } },
                      }}
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedNode(node)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#0E0E12]/85 hover:bg-[#14141A] text-xs text-zinc-200 hover:border-[#01B6FE]/50 hover:text-white transition-all duration-150 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#01B6FE]/15 cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotColor(
                          node.type
                        )}`}
                      />
                      <span className="font-medium text-xs">{node.name}</span>
                    </motion.button>
                  </PopoverTrigger>

                  <PopoverContent className="w-72 sm:w-80 p-3.5 text-xs bg-[#0C0C0F]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-xl" align="start">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-start justify-between border-b border-white/[0.07] pb-2 gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white text-sm truncate max-w-[200px]">{node.name}</span>
                          <span className="text-xs text-[#01B6FE] font-mono font-medium break-all">
                            {node.type}
                          </span>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-300 flex-shrink-0">
                          v{node.typeVersion || 1}
                        </span>
                      </div>

                      {/* Position & Connections */}
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <span>Position: [{node.position?.[0]}, {node.position?.[1]}]</span>
                        <span>{outgoingConnections.length} target(s)</span>
                      </div>

                      {/* Outgoing Targets */}
                      {outgoingConnections.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-white/[0.07] pt-2">
                          <span className="text-xs text-zinc-300 uppercase tracking-wider font-semibold">
                            Connects To:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {outgoingConnections.map((c, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-white/[0.04] text-zinc-200 border border-white/[0.08] max-w-[220px]"
                              >
                                <ArrowRight className="w-3 h-3 text-[#01B6FE] flex-shrink-0" />
                                <span className="truncate">{c.node}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parameters snippet */}
                      <div className="flex flex-col gap-1.5 border-t border-white/[0.07] pt-2">
                        <span className="text-xs text-zinc-300 uppercase tracking-wider font-semibold">
                          Parameters:
                        </span>
                        <pre className="text-xs font-mono bg-[#060608] border border-white/[0.06] p-2 rounded-lg max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all text-zinc-200 smooth-scroll-momentum">
                          {JSON.stringify(node.parameters || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {i < workflow.nodes.length - 1 && (
                  <span className="text-zinc-400 text-xs px-0.5 select-none font-mono font-semibold">
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

export default memo(NodePreview);
