'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Check, X, PlusCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { N8nWorkflow, N8nNode } from '@/lib/n8n-types';
import { ValidationResult } from '@/lib/validator';
import { getStoredPreferences } from '@/lib/settings';
import {
  getUserApiKey,
  getUserProvider,
  getUserActiveModel,
  purgeUserApiKey,
} from '@/lib/client/user-keys';

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
    const userKey = getUserApiKey();
    const userProvider = getUserProvider();
    const userModel = getUserActiveModel();

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userKey
            ? {
                'x-user-api-key': userKey,
                'x-user-provider': userProvider,
                'x-user-model': userModel,
              }
            : {}),
        },
        body: JSON.stringify({
          existingWorkflow: currentWorkflow,
          instruction: text,
          preferences,
          model: userModel,
        }),
      });

      const data = await res.json();

      if (res.status === 401 || (data.error && data.error.toLowerCase().includes('api key'))) {
        purgeUserApiKey();
        toast.error('API key expired or invalid. Key purged. Please reconnect in Preferences.');
        return;
      }

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
    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#0C0C0F]/90 backdrop-blur-md border border-white/[0.07] select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex-shrink-0 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#01B6FE]" />
          Refine Workflow
        </span>
        <span className="text-xs text-zinc-300 hidden sm:inline">Iterative AI modifications</span>
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRefine();
        }}
        className="flex items-center gap-2.5"
      >
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Add an error alert to Telegram if request fails, or change schedule to 8am"
          className="flex-1 px-3.5 py-2 rounded-lg bg-[#060608]/90 border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 transition-all duration-200 min-w-0"
          disabled={isRefining}
        />
        <motion.button
          type="submit"
          whileHover={{ scale: !instruction.trim() || isRefining ? 1 : 1.02, y: -1 }}
          whileTap={{ scale: !instruction.trim() || isRefining ? 1 : 0.96 }}
          disabled={!instruction.trim() || isRefining}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white disabled:opacity-40 disabled:text-zinc-400 transition-all duration-150 ease-out flex items-center gap-1.5 flex-shrink-0 shadow-[0_0_15px_rgba(3,135,254,0.35)] cursor-pointer"
        >
          {isRefining ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Refining…</span>
            </>
          ) : (
            <>
              <span>Apply</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </motion.button>
      </form>

      {/* Quick suggestions */}
      {!stagedResult && (
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto custom-scrollbar flex-nowrap smooth-scroll-momentum">
          {QUICK_SUGGESTIONS.map((sug) => (
            <motion.button
              key={sug}
              type="button"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setInstruction(sug);
                handleRefine(sug);
              }}
              className="text-xs px-2.5 py-1 rounded-lg border border-white/[0.06] bg-[#121217] text-zinc-300 hover:text-white hover:border-[#01B6FE]/40 hover:bg-[#01B6FE]/[0.08] transition-all duration-150 ease-out cursor-pointer flex-shrink-0 whitespace-nowrap"
            >
              + {sug}
            </motion.button>
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
            className="mt-1.5 p-3 rounded-xl border border-[#01B6FE]/30 bg-[#01B6FE]/[0.05] flex flex-col gap-2.5 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-100 truncate">
                Proposed Changes: &ldquo;{stagedResult.prompt}&rdquo;
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setStagedResult(null)}
                  className="px-2.5 py-1 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-white transition-all duration-150 active:scale-[0.97] cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Discard</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white flex items-center gap-1 shadow-sm transition-all duration-150 active:scale-[0.97] cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply Refinement</span>
                </button>
              </div>
            </div>

            {/* Diff Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs overflow-x-auto custom-scrollbar">
              {stagedResult.diff.added.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono text-xs max-w-[200px]"
                >
                  <PlusCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{node.name}</span>
                </span>
              ))}

              {stagedResult.diff.modified.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-300 font-mono text-xs max-w-[200px]"
                >
                  <RefreshCw className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="truncate">{node.name} (modified)</span>
                </span>
              ))}

              {stagedResult.diff.removed.map((node) => (
                <span
                  key={node.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 font-mono text-xs max-w-[200px]"
                >
                  <MinusCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span className="truncate">{node.name}</span>
                </span>
              ))}

              {stagedResult.diff.added.length === 0 &&
                stagedResult.diff.modified.length === 0 &&
                stagedResult.diff.removed.length === 0 && (
                  <span className="text-xs text-zinc-300">
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
