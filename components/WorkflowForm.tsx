'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Square, Zap } from 'lucide-react';
import { usePersonalizedSuggestions } from '@/lib/client/recommendations';
import { RankedSuggestion } from '@/lib/recommendations/ranking';

interface WorkflowFormProps {
  onGenerate: (description: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  externalDescription?: string;
  generationStep?: string;
}

export default function WorkflowForm({
  onGenerate,
  isLoading,
  onStop,
  externalDescription,
  generationStep,
}: WorkflowFormProps) {
  const [description, setDescription] = useState(externalDescription || '');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const { suggestions, trackAction } = usePersonalizedSuggestions(16);

  useEffect(() => {
    if (externalDescription !== undefined) {
      setDescription(externalDescription);
    }
  }, [externalDescription]);

  const handleSelectSuggestion = (item: RankedSuggestion) => {
    setDescription(item.description);
    trackAction(item.itemId, 'click', item.category, item.tags);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && !isLoading) {
      // Find matching suggestion tag or log as general generation
      trackAction('custom-generation', 'generate', 'Custom', []);
      onGenerate(description.trim());
    }
  };

  const categories = ['All', 'CRM & Leads', 'DevOps & Alerts', 'AI & Data', 'Messaging', 'Scheduling', 'Webhooks'];
  const displaySuggestions =
    activeCategory === 'All'
      ? suggestions
      : suggestions.filter((s) => s.category === activeCategory);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full gap-3">
      {/* Input Box with Decreased, Sleek Height */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Describe Your Automation
            </h3>
            <p className="text-xs text-zinc-300">
              Generate fully-configured, importable n8n workflow JSON
            </p>
          </div>
          <span className="text-[11px] text-zinc-300 font-medium font-mono px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] flex-shrink-0">
            {description.length} / 5,000 chars
          </span>
        </div>
        <textarea
          id="automation-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Every morning at 9am, fetch top Hacker News posts and send a summary to my Telegram"
          className="w-full h-24 sm:h-28 rounded-xl border border-white/[0.08] bg-[#060608]/90 shadow-inner text-zinc-100 placeholder:text-zinc-400 p-3 text-xs resize-none focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 transition-all duration-200 leading-relaxed"
          disabled={isLoading}
        />
      </div>

      {/* Expanded Suggestions Section at Bottom of Input Box */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 pt-0.5">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#02F7C8]" />
              Suggested Automations
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-mono font-semibold border border-white/[0.1]">
              {displaySuggestions.length}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
            Ranked by frequency &amp; recency
          </span>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all duration-150 flex-shrink-0 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-[#01B6FE] to-[#0387FE] text-white shadow-[0_0_12px_rgba(1,182,254,0.4)] border border-transparent'
                  : 'bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Rich Suggestions Cloud (Scrollable Multi-Pill Grid) */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-wrap content-start gap-1.5 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]">
          {displaySuggestions.map((preset) => (
            <motion.button
              key={preset.itemId}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleSelectSuggestion(preset)}
              title={`${preset.title} — ${preset.description}`}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/[0.08] bg-[#121217] text-zinc-200 hover:text-white hover:border-[#01B6FE]/60 hover:bg-[#01B6FE]/10 hover:-translate-y-[0.5px] active:translate-y-0 active:scale-[0.98] transition-all duration-150 will-change-transform cursor-pointer text-left shadow-xs"
            >
              <span className="truncate max-w-[260px] sm:max-w-none font-medium">{preset.title}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#02F7C8]/15 text-[#02F7C8] border border-[#02F7C8]/35 group-hover:bg-[#02F7C8]/25 group-hover:text-white transition-colors flex-shrink-0 shadow-xs">
                {preset.reason}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Button Controls */}
      <div className="flex items-center gap-2 pt-1 flex-shrink-0">
        <motion.button
          type="submit"
          disabled={!description.trim() || isLoading}
          whileHover={{ scale: !description.trim() || isLoading ? 1 : 1.01 }}
          whileTap={{ scale: !description.trim() || isLoading ? 1 : 0.99 }}
          transition={{ duration: 0.15 }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:bg-[#121217] disabled:text-zinc-400 disabled:border-white/[0.08] disabled:shadow-none disabled:cursor-not-allowed ${
            isLoading
              ? 'btn-shimmer-loading cursor-wait'
              : 'bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white shadow-[0_0_25px_-5px_rgba(3,135,254,0.45)] hover:shadow-[0_0_32px_-2px_rgba(117,1,253,0.65)] hover:-translate-y-[1px] active:translate-y-0 cursor-pointer'
          }`}
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>{generationStep || 'Building Workflow…'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Workflow</span>
            </>
          )}
        </motion.button>

        {isLoading && onStop && (
          <motion.button
            type="button"
            onClick={onStop}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="py-2.5 px-3 rounded-xl font-medium text-xs border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Stop generation"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </motion.button>
        )}
      </div>
    </form>
  );
}
