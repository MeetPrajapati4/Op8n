'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Square } from 'lucide-react';

const PRESETS = [
  {
    label: 'Webhook → Slack + Sheets',
    value:
      'When a webhook receives data, post a message to Slack and append a row to Google Sheets',
  },
  {
    label: 'Daily HN digest',
    value:
      'Every day at 9am, fetch the top 5 Hacker News posts via HTTP and send them as a formatted Telegram message',
  },
  {
    label: 'Lead capture',
    value:
      'When a Typeform webhook fires, add the lead to a Notion database and send a welcome email via Gmail',
  },
  {
    label: 'Uptime monitor',
    value:
      'Every 10 minutes, make an HTTP GET request to my website. If the status is not 200, send a Slack alert immediately',
  },
  {
    label: 'Sheets → WhatsApp',
    value:
      'When a new row is added to Google Sheets, send a WhatsApp message with the row contents via HTTP request to the WhatsApp API',
  },
  {
    label: 'File processor',
    value:
      'When a webhook receives a file URL, download it via HTTP, process it with a Code node, and save the result to Airtable',
  },
];

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

  useEffect(() => {
    if (externalDescription !== undefined) {
      setDescription(externalDescription);
    }
  }, [externalDescription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && !isLoading) {
      onGenerate(description.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full gap-3.5">
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Describe Your Automation
            </h3>
            <p className="text-xs text-zinc-400">
              Generate fully-configured, importable n8n workflow JSON
            </p>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] flex-shrink-0">
            {description.length} / 5,000 chars
          </span>
        </div>
        <textarea
          id="automation-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Every morning at 9am, fetch top Hacker News posts and send a summary to my Telegram"
          className="w-full flex-1 min-h-[130px] rounded-xl border border-white/[0.07] bg-[#060608]/90 shadow-inner text-zinc-100 placeholder:text-zinc-500 p-3 sm:p-3.5 text-xs resize-none focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200 leading-relaxed"
          disabled={isLoading}
        />
      </div>

      {/* Preset Chips */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Quick Automation Presets
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.label}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDescription(preset.value)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-white/[0.07] bg-[#121217] text-zinc-300 hover:text-white hover:border-[#FF6D5A]/50 hover:bg-[#FF6D5A]/[0.08] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98] transition-all duration-150 will-change-transform cursor-pointer"
            >
              {preset.label}
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
          className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:bg-zinc-900/80 disabled:text-zinc-500 disabled:border-white/[0.05] disabled:shadow-none disabled:cursor-not-allowed ${
            isLoading
              ? 'btn-shimmer-loading cursor-wait'
              : 'bg-gradient-to-r from-[#FF6D5A] to-[#E6496D] text-white shadow-[0_0_25px_-5px_rgba(255,109,90,0.45)] hover:shadow-[0_0_32px_-2px_rgba(255,109,90,0.65)] hover:-translate-y-[1px] active:translate-y-0 cursor-pointer'
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
