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
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white">
              Describe Your Automation
            </h3>
            <p className="text-[11px] text-zinc-400">
              Generate fully-configured, importable n8n workflow JSON
            </p>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] flex-shrink-0">
            {description.length} / 5,000 chars
          </span>
        </div>
        <textarea
          id="automation-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Every morning at 9am, fetch top Hacker News posts and send a summary to my Telegram"
          className="w-full h-28 sm:h-32 rounded-xl border border-white/[0.1] bg-[#060608]/90 shadow-inner text-white placeholder:text-zinc-400 p-3 text-xs resize-none focus:outline-none focus:border-[#01B6FE]/60 focus:ring-2 focus:ring-[#01B6FE]/20 transition-colors leading-relaxed"
          disabled={isLoading}
        />
      </div>

      {/* Expanded Suggestions Section at Bottom of Input Box */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 pt-0.5">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-[#02F7C8]" />
              Suggested Automations
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.06] text-zinc-300 font-mono font-semibold border border-white/[0.1]">
              {displaySuggestions.length}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-normal hidden sm:inline">
            Ranked by frequency &amp; recency
          </span>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden smooth-scroll-momentum">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium flex-shrink-0 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-[#01B6FE] to-[#0387FE] text-white shadow-xs border border-transparent'
                  : 'bg-white/[0.04] text-zinc-300 border border-white/[0.08]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Rich Suggestions Cloud (Scrollable Multi-Pill Grid) */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-wrap content-start gap-1.5 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden smooth-scroll-momentum">
          {displaySuggestions.map((preset) => (
            <button
              key={preset.itemId}
              type="button"
              onClick={() => handleSelectSuggestion(preset)}
              title={`${preset.title} — ${preset.description}`}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-normal border border-white/[0.08] bg-[#121217] text-zinc-200 cursor-pointer text-left active:scale-[0.99] transition-none shadow-xs"
            >
              <span className="truncate max-w-[170px] xs:max-w-[240px] sm:max-w-none text-xs font-medium text-zinc-200">
                {preset.title}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#02F7C8]/10 text-[#02F7C8] border border-[#02F7C8]/25 flex-shrink-0">
                {preset.reason}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Button Controls */}
      <div className="flex items-center gap-2 pt-1 flex-shrink-0">
        <motion.button
          type="submit"
          disabled={!description.trim() || isLoading}
          whileTap={{ scale: !description.trim() || isLoading ? 1 : 0.99 }}
          transition={{ duration: 0.1 }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-2 transition-opacity disabled:bg-[#121217] disabled:text-zinc-400 disabled:border-white/[0.08] disabled:shadow-none disabled:cursor-not-allowed ${
            isLoading
              ? 'btn-shimmer-loading cursor-wait'
              : 'bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white shadow-[0_0_20px_-5px_rgba(3,135,254,0.35)] cursor-pointer'
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
          <button
            type="button"
            onClick={onStop}
            className="py-2 px-3 rounded-xl font-medium text-xs border border-red-900/60 bg-red-950/40 text-red-300 flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Stop generation"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        )}
      </div>
    </form>
  );
}
