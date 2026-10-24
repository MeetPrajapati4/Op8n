'use client';

import { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, Server, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  WorkflowPreferences,
  DEFAULT_PREFERENCES,
  getStoredPreferences,
  saveStoredPreferences,
} from '@/lib/settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (prefs: WorkflowPreferences) => void;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function SettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: SettingsDialogProps) {
  const [prefs, setPrefs] = useState<WorkflowPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (open) {
      setPrefs(getStoredPreferences());
    }
  }, [open]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredPreferences(prefs);
    toast.success('Workflow preferences saved!');
    onSaved?.(prefs);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-[#18181b] border-[#2e2e35] text-zinc-100 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#FF6D5A]" />
            Workflow Engine Preferences
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Customize how Op8n shapes, formats, and deploys your generated n8n workflows.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4 mt-1">
          {/* Section 1: Generation Preferences */}
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-[#111113] border border-[#2e2e35]">
            <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Canvas &amp; Generation Rules
            </span>

            {/* Error handling strategy */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span>Default Node Error Handling</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {prefs.errorHandling === 'continue'
                    ? 'continueOnFail'
                    : prefs.errorHandling === 'retry'
                    ? '3 retries'
                    : 'strict halt'}
                </span>
              </label>
              <select
                value={prefs.errorHandling}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    errorHandling: e.target.value as 'none' | 'continue' | 'retry',
                  }))
                }
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e35] text-xs text-zinc-200 focus:outline-none focus:border-[#FF6D5A]"
              >
                <option value="none">Strict (Stop on error)</option>
                <option value="continue">Resilient (Continue execution on failure)</option>
                <option value="retry">Auto-Retry (Retry failed action nodes 3x)</option>
              </select>
            </div>

            {/* Layout Spacing */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                <span>Canvas Node Spacing</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {prefs.layoutSpacing}px offset
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Compact', value: 180 },
                  { label: 'Standard', value: 220 },
                  { label: 'Spacious', value: 280 },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        layoutSpacing: s.value as 180 | 220 | 280,
                      }))
                    }
                    className={`py-1.5 text-xs font-medium rounded-md border transition-all ${
                      prefs.layoutSpacing === s.value
                        ? 'border-[#FF6D5A] bg-[#FF6D5A]/15 text-white font-semibold'
                        : 'border-[#2e2e35] bg-[#18181b] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {s.label} ({s.value}px)
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Default Schedule Timezone
              </label>
              <select
                value={prefs.timezone}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, timezone: e.target.value }))
                }
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e35] text-xs text-zinc-200 focus:outline-none focus:border-[#FF6D5A]"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-2 pt-1 border-t border-[#232328]">
              {/* PinData Mock Data Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300 hover:text-white">
                <div className="flex flex-col">
                  <span className="font-medium">Inject Sample Mock Payloads (pinData)</span>
                  <span className="text-[11px] text-zinc-500">
                    Allows immediate testing in n8n canvas without live webhooks
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.injectPinData}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, injectPinData: e.target.checked }))
                  }
                  className="rounded border-[#2e2e35] text-[#FF6D5A] focus:ring-[#FF6D5A] w-4 h-4 cursor-pointer"
                />
              </label>

              {/* Sticky Note Documentation Toggle */}
              <label className="flex items-center justify-between cursor-pointer text-xs text-zinc-300 hover:text-white">
                <div className="flex flex-col">
                  <span className="font-medium">Auto-add Canvas Sticky Note</span>
                  <span className="text-[11px] text-zinc-500">
                    Generates a sticky note with workflow summary &amp; credentials checklist
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.addStickyNote}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, addStickyNote: e.target.checked }))
                  }
                  className="rounded border-[#2e2e35] text-[#FF6D5A] focus:ring-[#FF6D5A] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 2: n8n Instance Connection for 1-Click Deploy */}
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-[#111113] border border-[#2e2e35]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#FF6D5A]" />
                n8n Instance (Optional)
              </span>
              <span className="text-[10px] text-zinc-500">For 1-click deploy</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">
                n8n Base URL
              </label>
              <input
                type="url"
                value={prefs.n8nBaseUrl || ''}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, n8nBaseUrl: e.target.value }))
                }
                placeholder="e.g. https://n8n.yourdomain.com"
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">
                n8n API Key
              </label>
              <input
                type="password"
                value={prefs.n8nApiKey || ''}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, n8nApiKey: e.target.value }))
                }
                placeholder="n8n_api_key_..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#2e2e35]">
            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Built-in Fast AI Engine Active</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2e2e35] text-zinc-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 transition-opacity"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
