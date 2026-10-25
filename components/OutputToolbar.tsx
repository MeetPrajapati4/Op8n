'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download, HelpCircle, Layers, Activity, Send, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ValidationBadge from '@/components/ValidationBadge';
import { ValidationResult } from '@/lib/validator';
import { N8nWorkflow } from '@/lib/n8n-types';

interface OutputToolbarProps {
  workflow: N8nWorkflow | null;
  jsonString: string | null;
  validation: ValidationResult | null;
  onOpenDeploy?: () => void;
  onNewSession?: () => void;
}

export function calculateComplexity(workflow: N8nWorkflow | null): {
  level: 'Simple' | 'Moderate' | 'Complex';
  color: string;
} {
  if (!workflow || !workflow.nodes) return { level: 'Simple', color: '#a1a1aa' };

  const nodeCount = workflow.nodes.length;
  const connectionCount = Object.values(workflow.connections || {}).reduce(
    (acc, conn) => acc + (conn.main?.flat().length ?? 0),
    0
  );

  // Check for branching (a node with >1 connections out)
  const hasBranching = Object.values(workflow.connections || {}).some(
    (conn) => (conn.main?.length ?? 0) > 1 || (conn.main?.[0]?.length ?? 0) > 1
  );

  if (nodeCount <= 3 && !hasBranching) {
    return { level: 'Simple', color: '#02F7C8' };
  }
  if (nodeCount <= 7 && connectionCount <= 8) {
    return { level: 'Moderate', color: '#01B6FE' };
  }
  return { level: 'Complex', color: '#c084fc' };
}

export default function OutputToolbar({
  workflow,
  jsonString,
  validation,
  onOpenDeploy,
  onNewSession,
}: OutputToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!jsonString) return;
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      toast.success('Workflow JSON copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [jsonString]);

  const handleDownload = useCallback(() => {
    if (!jsonString) return;
    const safeName = (workflow?.name || 'workflow')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${safeName}.json`);
  }, [jsonString, workflow?.name]);

  if (!workflow && !jsonString) return null;

  const nodeCount = workflow?.nodes?.length ?? 0;
  const complexity = calculateComplexity(workflow);

  return (
    <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 bg-[#0C0C0F]/90 backdrop-blur-md border border-white/[0.07] rounded-xl select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap flex-shrink-0 min-w-0 smooth-scroll-momentum">
      {/* Left: Metrics & Validation */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
        {/* Node count */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-200 flex-shrink-0">
          <Layers className="w-3.5 h-3.5 text-[#01B6FE]" />
          <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
        </div>

        {/* Complexity badge */}
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs flex-shrink-0"
          style={{
            borderColor: `${complexity.color}40`,
            backgroundColor: `${complexity.color}15`,
            color: complexity.color,
          }}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{complexity.level}</span>
        </div>

        {/* Validation Status Badge */}
        <div className="flex-shrink-0">
          <ValidationBadge validation={validation} />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* How to import popover */}
        <Popover>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-300" />
              <span><span className="hidden sm:inline">Import </span>Guide</span>
            </motion.button>
          </PopoverTrigger>
          <PopoverContent className="w-80 sm:w-84 max-w-[calc(100vw-2rem)] p-3.5 bg-[#0C0C0F]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-xl no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" align="end" data-lenis-prevent="true">
            <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider mb-2.5">
              How to import into n8n (3 Steps)
            </h4>
            <div className="flex flex-col gap-2.5 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <p className="leading-snug">
                  Click <strong className="text-white">Copy JSON</strong> above or download the <code className="text-[#01B6FE] bg-white/[0.06] border border-white/[0.08] px-1 py-0.5 rounded text-xs font-mono">.json</code> file.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <p className="leading-snug">
                  In your n8n workspace, open any canvas and press <kbd className="bg-zinc-800/90 border border-white/10 border-b-2 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-100">Ctrl+V</kbd> (<kbd className="bg-zinc-800/90 border border-white/10 border-b-2 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-100">Cmd+V</kbd>) or use <strong className="text-white">Menu → Import from JSON</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <p className="leading-snug">
                  Connect your credentials on the highlighted service nodes, then toggle <strong className="text-emerald-400">Active</strong> to run!
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Copy JSON */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-300" />
              <span>Copy<span className="hidden sm:inline"> JSON</span></span>
            </>
          )}
        </motion.button>

        {/* Send to n8n */}
        {onOpenDeploy && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onOpenDeploy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#01B6FE]/15 hover:bg-[#01B6FE]/25 text-white border border-[#01B6FE]/40 hover:border-[#01B6FE]/70 transition-all duration-150 ease-out cursor-pointer focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 shadow-xs flex-shrink-0"
            title="Deploy directly to your connected n8n instance"
          >
            <Send className="w-3.5 h-3.5 text-[#02F7C8]" />
            <span><span className="hidden sm:inline">Send to </span>n8n</span>
          </motion.button>
        )}

        {/* New Session */}
        {onNewSession && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={onNewSession}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
            title="Start a new blank workflow session"
          >
            <Plus className="w-3.5 h-3.5 text-[#02F7C8]" />
            <span>New</span>
          </motion.button>
        )}

        {/* Download JSON */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white transition-all duration-150 ease-out shadow-[0_0_15px_rgba(3,135,254,0.35)] cursor-pointer focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </motion.button>
      </div>
    </div>
  );
}
