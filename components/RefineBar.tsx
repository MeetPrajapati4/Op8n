'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Check, X, PlusCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { N8nWorkflow, N8nNode } from '@/lib/n8n-types';
import { ValidationResult } from '@/lib/validator';
import { getStoredPreferences } from '@/lib/settings';

interface RefineBarProps {
  currentWorkflow: N8nWorkflow | null;
  onApplyRefinement: (newWorkflow: N8nWorkflow, newValidation: ValidationResult, prompt: string) => void;
}

interface WorkflowDiff {
  added: N8nNode[];
  removed: N8nNode[];
  modified: N8nNode[];
}

function calculateDiff(oldWf: N8nWorkflow, newWf: N8nWorkflow): WorkflowDiff {
  const oldNodeMap = new Map<string, N8nNode>(oldWf.nodes.map((n) => [n.name, n]));
  const newNodeMap = new Map<string, N8nNode>(newWf.nodes.map((n) => [n.name, n]));

  const added: N8nNode[] = [];
  const removed: N8nNode[] = [];
  const modified: N8nNode[] = [];

  for (const [name, node] of newNodeMap.entries()) {
    if (!oldNodeMap.has(name)) {
      added.push(node);
    } else {
      const oldNode = oldNodeMap.get(name)!;
      if (
        oldNode.type !== node.type ||
        JSON.stringify(oldNode.parameters) !== JSON.stringify(node.parameters)
      ) {
        modified.push(node);
      }
    }
  }

  for (const [name, node] of oldNodeMap.entries()) {
    if (!newNodeMap.has(name)) {
      removed.push(node);
    }
  }

  return { added, removed, modified };
}

const QUICK_SUGGESTIONS = [
  'Add Slack alert if HTTP status is not 200',
  'Add a Telegram message after execution',
  'Filter out duplicate rows with Code node',
  'Add email notification on completion',
];

export default function RefineBar({ currentWorkflow, onApplyRefinement }: RefineBarProps) {
  const [instruction, setInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [stagedResult, setStagedResult] = useState<{
    workflow: N8nWorkflow;
    validation: ValidationResult;
    diff: WorkflowDiff;
    prompt: string;
  } | null>(null);

  if (!currentWorkflow) return null;

  const handleRefine = async (customText?: string) => {
    const text = (customText || instruction).trim();
    if (!text || isRefining) return;

    setIsRefining(true);
    const preferences = getStoredPreferences();

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingWorkflow: currentWorkflow,
          instruction: text,
          preferences,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Refinement failed');
      }

      const diff = calculateDiff(currentWorkflow, data.workflow);
      setStagedResult({
        workflow: data.workflow,
        validation: data.validation,
        diff,
        prompt: text,
      });

      toast.success('Refinement ready for review!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refine';
      toast.error(msg);
    } finally {
      setIsRefining(false);
    }
  };

  const handleConfirmApply = () => {
    if (!stagedResult) return;
    onApplyRefinement(stagedResult.workflow, stagedResult.validation, stagedResult.prompt);
    setStagedResult(null);
    setInstruction('');
    toast.success('Workflow updated with refinement!');
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-[#141416] border border-[#2e2e35] select-none">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6D5A]" />
          Refine Workflow
        </span>
        <span className="text-[10px] text-zinc-500">Iterative AI modifications</span>
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRefine();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Add an error alert to Telegram if request fails, or change schedule to 8am"
          className="flex-1 px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A]"
          disabled={isRefining}
        />
        <button
          type="submit"
          disabled={!instruction.trim() || isRefining}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1 flex-shrink-0"
        >
          {isRefining ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Refining…</span>
            </>
          ) : (
            <>
              <span>Apply</span>
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </form>

      {/* Quick suggestions */}
      {!stagedResult && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {QUICK_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => {
                setInstruction(sug);
                handleRefine(sug);
              }}
              className="text-[10px] px-2 py-0.5 rounded border border-[#2e2e35] bg-[#18181b] text-zinc-400 hover:text-[#FF6D5A] hover:border-[#FF6D5A]/40 transition-colors"
            >
              + {sug}
            </button>
          ))}
        </div>
      )}

      {/* Staged Result Diff Banner */}
      <AnimatePresence>
        {stagedResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 p-2.5 rounded-lg border border-[#FF6D5A]/40 bg-[#1c1819] flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">
                Proposed Changes: &ldquo;{stagedResult.prompt}&rdquo;
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStagedResult(null)}
                  className="px-2.5 py-1 rounded text-xs border border-[#2e2e35] text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Discard</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  className="px-3 py-1 rounded text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply Refinement</span>
                </button>
              </div>
            </div>

            {/* Diff Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {stagedResult.diff.added.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono text-[11px]"
                >
                  <PlusCircle className="w-3 h-3 text-emerald-400" />
                  <span>{node.name}</span>
                </span>
              ))}

              {stagedResult.diff.modified.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 font-mono text-[11px]"
                >
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                  <span>{node.name} (modified)</span>
                </span>
              ))}

              {stagedResult.diff.removed.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60 text-red-300 font-mono text-[11px]"
                >
                  <MinusCircle className="w-3 h-3 text-red-400" />
                  <span>{node.name}</span>
                </span>
              ))}

              {stagedResult.diff.added.length === 0 &&
                stagedResult.diff.modified.length === 0 &&
                stagedResult.diff.removed.length === 0 && (
                  <span className="text-[11px] text-zinc-400">
                    Workflow parameters optimized.
                  </span>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
