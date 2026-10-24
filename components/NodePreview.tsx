'use client';

import { motion } from 'framer-motion';
import { N8nWorkflow } from '@/lib/n8n-types';

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
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Node Flow Preview
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
              transition: { staggerChildren: 0.05, duration: 0.25 },
            },
          }}
          className="flex items-center gap-1.5 min-w-max py-0.5"
        >
          {workflow.nodes.map((node, i) => (
            <motion.div
              key={node.id || node.name}
              variants={{
                hidden: { opacity: 0, y: 4 },
                show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
              }}
              className="flex items-center gap-1.5"
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2e2e35] bg-[#141416] text-xs text-zinc-300 hover:border-[#FF6D5A]/40 transition-colors shadow-sm"
                title={`${node.name} (${node.type})`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotColor(
                    node.type
                  )}`}
                />
                <span className="font-medium text-zinc-200">{node.name}</span>
              </div>
              {i < workflow.nodes.length - 1 && (
                <span className="text-zinc-600 text-xs px-0.5 select-none font-mono">
                  →
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
