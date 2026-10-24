'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Download, HelpCircle, Layers, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ValidationBadge from '@/components/ValidationBadge';
import { ValidationResult } from '@/lib/validator';
import { N8nWorkflow } from '@/lib/n8n-types';

interface OutputToolbarProps {
  workflow: N8nWorkflow | null;
  jsonString: string | null;
  validation: ValidationResult | null;
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
    return { level: 'Simple', color: '#34d399' };
  }
  if (nodeCount <= 7 && connectionCount <= 8) {
    return { level: 'Moderate', color: '#60a5fa' };
  }
  return { level: 'Complex', color: '#f472b6' };
}

export default function OutputToolbar({
  workflow,
  jsonString,
  validation,
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
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#141416] border border-[#2e2e35] rounded-lg select-none">
      {/* Left: Metrics & Validation */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Node count */}
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1f1f23] border border-[#2e2e35] text-xs font-mono text-zinc-300">
          <Layers className="w-3 h-3 text-zinc-400" />
          <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
        </div>

        {/* Complexity badge */}
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
          style={{
            borderColor: `${complexity.color}40`,
            backgroundColor: `${complexity.color}15`,
            color: complexity.color,
          }}
        >
          <Activity className="w-3 h-3" />
          <span>{complexity.level}</span>
        </div>

        {/* Validation Status Badge */}
        <ValidationBadge validation={validation} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* How to import popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-[#2e2e35] bg-[#18181b] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors focus:outline-none focus:ring-1 focus:ring-[#FF6D5A]"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import Guide</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider mb-3">
              How to import into n8n (3 Steps)
            </h4>
            <div className="flex flex-col gap-3 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <p className="leading-tight">
                  Click <strong className="text-white">Copy JSON</strong> above or download the <code className="text-[#FF6D5A] bg-[#1f1f23] px-1 py-0.5 rounded">.json</code> file.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <p className="leading-tight">
                  In your n8n workspace, open any canvas and press <kbd className="bg-[#27272a] text-zinc-200 px-1 py-0.5 rounded text-[11px] font-mono border border-[#3f3f46]">Ctrl+V</kbd> (<kbd className="bg-[#27272a] text-zinc-200 px-1 py-0.5 rounded text-[11px] font-mono border border-[#3f3f46]">Cmd+V</kbd>) or use <strong className="text-white">Menu → Import from JSON</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <p className="leading-tight">
                  Connect your credentials on the highlighted service nodes, then toggle <strong className="text-emerald-400">Active</strong> to run!
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Copy JSON */}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-[#2e2e35] bg-[#18181b] text-zinc-200 hover:text-white hover:border-zinc-500 transition-colors focus:outline-none focus:ring-1 focus:ring-[#FF6D5A]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy JSON</span>
            </>
          )}
        </button>

        {/* Download JSON */}
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-1 focus:ring-[#FF6D5A]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}
