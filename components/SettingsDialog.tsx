'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  CheckCircle2,
  Key,
  Sparkles,
  Loader2,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
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
import {
  hasUserApiKey,
  getUserProvider,
  getUserModels,
  getUserActiveModel,
  setUserApiKey,
  setUserActiveModel,
  purgeUserApiKey,
  detectProviderFromKey,
  onUserKeyChange,
} from '@/lib/client/user-keys';
import { PROVIDER_REGISTRY } from '@/lib/registry/providers';
import { filterSuitableWorkflowModels, getFriendlyModelName } from '@/lib/registry/model-filter';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (prefs: WorkflowPreferences) => void;
  cloudEngineActive?: boolean;
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
  cloudEngineActive = true,
}: SettingsDialogProps) {
  const [prefs, setPrefs] = useState<WorkflowPreferences>(DEFAULT_PREFERENCES);

  // Per-User Key State
  const [hasKey, setHasKey] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [isValidating, setIsValidating] = useState(false);

  // Dynamic Models State
  const [userModels, setUserModels] = useState<Array<{ id: string; name: string }>>([]);
  const [activeModel, setActiveModel] = useState<string>('gemini-2.5-flash');

  const refreshUserState = useCallback(() => {
    const configured = hasUserApiKey();
    setHasKey(configured);
    if (configured) {
      const p = getUserProvider();
      setSelectedProvider(p);
      const models = getUserModels();
      setUserModels(models);
      setActiveModel(getUserActiveModel());
    } else {
      setUserModels([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPrefs(getStoredPreferences());
      refreshUserState();
      setInputKey('');
    }
  }, [open, refreshUserState]);

  useEffect(() => {
    return onUserKeyChange(() => {
      refreshUserState();
    });
  }, [refreshUserState]);

  // Auto-detect provider as user types or pastes key
  const handleKeyChange = (val: string) => {
    setInputKey(val);
    if (val.trim().length > 6) {
      const detected = detectProviderFromKey(val);
      setSelectedProvider(detected);
    }
  };

  // Validate and Save Key Flow: Write-Once & Vanish
  const handleConnectKey = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      toast.error('Please enter an API key');
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: trimmed,
          provider: selectedProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to validate API key');
      }

      const rawModels = data.models || [];
      const models = filterSuitableWorkflowModels(rawModels).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.contextWindow,
      }));
      const defaultModel = models[0]?.id || 'default';

      // Store obfuscated strictly in client storage; never rendered to DOM
      setUserApiKey(trimmed, data.provider || selectedProvider, models, defaultModel);

      // Immediately clear in-memory input so it vanishes from memory and state
      setInputKey('');
      setHasKey(true);
      setUserModels(models);
      setActiveModel(defaultModel);

      toast.success(
        `Connected to ${data.providerName || selectedProvider}! Loaded ${models.length} permitted models.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid API key';
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleModelSelect = (newModel: string) => {
    setActiveModel(newModel);
    setUserActiveModel(selectedProvider, newModel);
    toast.info(`Active model set to: ${newModel}`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredPreferences(prefs);
    toast.success('Preferences saved successfully!');
    onSaved?.(prefs);
    onOpenChange(false);
  };

  const providerEntry = PROVIDER_REGISTRY[selectedProvider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[94vw] sm:max-w-[840px] md:max-w-[880px] max-h-[88vh] overflow-y-auto bg-[#0C0C0F]/95 backdrop-blur-2xl border border-white/[0.08] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.7)] p-5 sm:p-6 rounded-2xl smooth-scroll-momentum"
        data-lenis-prevent="true"
      >
        <DialogHeader className="pb-1">
          <DialogTitle className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#FF6D5A]" />
            Workflow Engine Preferences &amp; Models
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Configure your AI credentials, model selection, and workflow canvas formatting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-3.5 mt-1">
          {/* Main 2-Column Horizontal Box Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Left Column: AI Credentials / Active Model + Schema Target */}
            <div className="flex flex-col gap-3">
              {/* 1. API Key Setup OR Active Model Selection */}
              <AnimatePresence mode="wait">
                {!hasKey ? (
                  <motion.div
                    key="key-setup"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#08080B]/80 border border-[#FF6D5A]/30 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-[#FF6D5A]" />
                        API Key Setup
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#FF6D5A]/10 text-rose-300 border border-[#FF6D5A]/20">
                        Write-Once &amp; Vanish
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Enter your key once. Validated directly with provider API and encrypted locally.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1 sm:col-span-1">
                        <label className="text-xs font-medium text-zinc-300">
                          Provider
                        </label>
                        <select
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#121217] border border-white/[0.08] hover:border-white/[0.15] text-xs text-zinc-200 focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200 cursor-pointer"
                        >
                          {Object.values(PROVIDER_REGISTRY).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs font-medium text-zinc-300">
                          Secret API Key
                        </label>
                        <input
                          type="password"
                          value={inputKey}
                          onChange={(e) => handleKeyChange(e.target.value)}
                          placeholder="Paste key (AIzaSy..., sk-...)"
                          autoComplete="off"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#060608] border border-white/[0.08] text-xs text-zinc-200 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Supported Generation Models Preview for selected provider */}
                    {providerEntry?.staticModels && providerEntry.staticModels.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>Supported Generation Models:</span>
                          <span className="font-mono text-emerald-400 text-xs font-semibold">
                            {providerEntry.staticModels.length} verified
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {providerEntry.staticModels.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-300 border border-white/[0.08]"
                            >
                              {getFriendlyModelName(m.id, m.name)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <motion.button
                      type="button"
                      onClick={handleConnectKey}
                      disabled={isValidating || !inputKey.trim()}
                      whileHover={{ scale: isValidating || !inputKey.trim() ? 1 : 1.01 }}
                      whileTap={{ scale: isValidating || !inputKey.trim() ? 1 : 0.98 }}
                      className="w-full py-2 px-3.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#E6496D] hover:brightness-110 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validating Key &amp; Fetching Models…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Connect &amp; Save Key</span>
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="key-connected"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#08080B]/80 border border-white/[0.07] shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                        <span className="text-xs font-semibold text-white">
                          Active Model &bull; {providerEntry?.name || selectedProvider}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                          {userModels.length} models
                        </span>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            purgeUserApiKey();
                            setHasKey(false);
                            setUserModels([]);
                            toast.info('API key cleared. You can reconnect anytime.');
                          }}
                          className="text-xs text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          title="Disconnect key and reset"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Change</span>
                        </motion.button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-zinc-300">
                        Select generation model for workflows &amp; auditing:
                      </label>
                      <select
                        value={activeModel}
                        onChange={(e) => handleModelSelect(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#121217] border border-white/[0.08] hover:border-white/[0.15] text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200 cursor-pointer"
                      >
                        {userModels.map((m) => {
                          const friendly = getFriendlyModelName(m.id, m.name);
                          return (
                            <option key={m.id} value={m.id}>
                              {friendly} ({m.id})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Schema Target */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#08080B]/80 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Schema Target
                  </span>
                  <span className="text-xs font-mono text-zinc-400">n8n syntax version</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPrefs((prev) => ({ ...prev, targetVersion: 'v1' }))
                    }
                    className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      prefs.targetVersion === 'v1'
                        ? 'border-[#FF6D5A]/60 bg-[#FF6D5A]/15 text-white ring-1 ring-[#FF6D5A]/30 shadow-[0_0_15px_rgba(255,109,90,0.15)]'
                        : 'border-white/[0.06] bg-[#121217] text-zinc-400 hover:text-white hover:border-white/[0.15]'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white">n8n v1.x (Modern)</span>
                    <span className="text-xs text-zinc-400">UUIDs &amp; typeVersions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrefs((prev) => ({ ...prev, targetVersion: 'v0' }))
                    }
                    className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      prefs.targetVersion === 'v0'
                        ? 'border-[#FF6D5A]/60 bg-[#FF6D5A]/15 text-white ring-1 ring-[#FF6D5A]/30 shadow-[0_0_15px_rgba(255,109,90,0.15)]'
                        : 'border-white/[0.06] bg-[#121217] text-zinc-400 hover:text-white hover:border-white/[0.15]'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white">n8n v0.x (Legacy)</span>
                    <span className="text-xs text-zinc-400">Numeric node IDs</span>
                  </button>
                </div>
              </div>

              {/* Serverless engine status */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#08080B]/80 border border-white/[0.06] text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-zinc-300">
                    {hasKey ? 'Personal key active (browser encrypted)' : cloudEngineActive ? 'Serverless cloud engine active' : 'API key required'}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-400">Vercel Edge</span>
              </div>
            </div>

            {/* Right Column: Canvas & Generation Rules */}
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#08080B]/80 border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Canvas &amp; Generation Rules
                </span>
                <span className="text-xs font-mono text-zinc-400">Formatting</span>
              </div>

              {/* Error handling strategy */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-200 flex items-center justify-between">
                  <span>Default Node Error Handling</span>
                  <span className="text-xs text-zinc-400 font-mono">
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
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#121217] border border-white/[0.08] hover:border-white/[0.15] text-xs text-zinc-200 focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200 cursor-pointer"
                >
                  <option value="none">Strict (Stop on error)</option>
                  <option value="continue">Resilient (Continue execution on failure)</option>
                  <option value="retry">Auto-Retry (Retry failed action nodes 3x)</option>
                </select>
              </div>

              {/* Layout Spacing Segmented Control */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-200 flex items-center justify-between">
                  <span>Canvas Node Spacing</span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {prefs.layoutSpacing === 180
                      ? 'Compact (180px)'
                      : prefs.layoutSpacing === 280
                      ? 'Spacious (280px)'
                      : 'Standard (220px)'}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Compact', val: 180 },
                    { label: 'Standard', val: 220 },
                    { label: 'Spacious', val: 280 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() =>
                        setPrefs((prev) => ({
                          ...prev,
                          layoutSpacing: item.val as 180 | 220 | 280,
                        }))
                      }
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        prefs.layoutSpacing === item.val
                          ? 'bg-[#FF6D5A]/15 border-[#FF6D5A]/60 text-white shadow-[0_0_15px_rgba(255,109,90,0.15)] ring-1 ring-[#FF6D5A]/30 font-semibold'
                          : 'bg-[#121217] border-white/[0.06] text-zinc-300 hover:text-white hover:border-white/[0.15]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Schedule Timezone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-200 flex items-center justify-between">
                  <span>Default Schedule Timezone</span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {prefs.timezone || 'UTC'}
                  </span>
                </label>
                <select
                  value={prefs.timezone || 'UTC'}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#121217] border border-white/[0.08] hover:border-white/[0.15] text-xs text-zinc-200 focus:outline-none focus:border-[#FF6D5A]/50 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-200 cursor-pointer"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom styled checkboxes */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <div className="pr-3">
                  <span className="text-xs text-zinc-200 font-medium block">
                    Inject Sample Mock Payloads (pinData)
                  </span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Add sample data on trigger nodes for instant testing
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.injectPinData}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, injectPinData: e.target.checked }))
                  }
                  className="w-4 h-4 rounded-md border border-white/20 bg-zinc-900 checked:bg-[#FF6D5A] checked:border-[#FF6D5A] text-[#FF6D5A] accent-[#FF6D5A] focus:ring-4 focus:ring-[#FF6D5A]/10 cursor-pointer transition-all duration-200 flex-shrink-0"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <div className="pr-3">
                  <span className="text-xs text-zinc-200 font-medium block">
                    Auto-add Canvas Sticky Note
                  </span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Place an annotated sticky note describing the flow
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.addStickyNote}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, addStickyNote: e.target.checked }))
                  }
                  className="w-4 h-4 rounded-md border border-white/20 bg-zinc-900 checked:bg-[#FF6D5A] checked:border-[#FF6D5A] text-[#FF6D5A] accent-[#FF6D5A] focus:ring-4 focus:ring-[#FF6D5A]/10 cursor-pointer transition-all duration-200 flex-shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
            <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
              Op8n Studio Engine
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-zinc-200 hover:text-white transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#E6496D] hover:brightness-110 text-white shadow-[0_0_20px_-3px_rgba(255,109,90,0.4)] hover:shadow-[0_0_25px_0px_rgba(255,109,90,0.6)] transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
