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
        className="w-[96vw] sm:max-w-[1040px] md:max-w-[1140px] lg:max-w-[1200px] max-h-[92vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-[#0C0C0F]/95 backdrop-blur-2xl border border-white/[0.12] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.85)] p-5 sm:p-6 rounded-2xl smooth-scroll-momentum"
        data-lenis-prevent="true"
      >
        <DialogHeader className="pb-2 border-b border-white/[0.08]">
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#01B6FE]" />
            Workflow Engine Preferences &amp; Models
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-zinc-200 leading-relaxed mt-0.5">
            Configure your AI credentials, model selection, and workflow canvas formatting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-3.5 mt-1.5">
          {/* Main 2-Column Horizontal Box Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
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
                    className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl bg-[#121217] border border-white/[0.12] shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#01B6FE]" />
                        API Key Setup
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#01B6FE]/15 text-[#01B6FE] border border-[#01B6FE]/30">
                        Write-Once &amp; Vanish
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                      Enter your key once. Validated directly with provider API and encrypted locally.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1 sm:col-span-1">
                        <label className="text-xs font-semibold text-white">
                          Provider
                        </label>
                        <select
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          className="w-full h-10 px-3 py-1.5 rounded-xl bg-[#181820] border border-white/[0.15] hover:border-white/[0.25] text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200 cursor-pointer"
                        >
                          {Object.values(PROVIDER_REGISTRY).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs font-semibold text-white">
                          Secret API Key
                        </label>
                        <input
                          type="password"
                          value={inputKey}
                          onChange={(e) => handleKeyChange(e.target.value)}
                          placeholder="Paste key (AIzaSy..., sk-...)"
                          autoComplete="off"
                          className="w-full h-10 px-3.5 py-1.5 rounded-xl bg-[#181820] border border-white/[0.15] text-xs sm:text-sm text-white font-mono placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Supported Generation Models Preview for selected provider */}
                    {providerEntry?.staticModels && providerEntry.staticModels.length > 0 && (
                      <div className="flex flex-col gap-1 pt-0.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-white">
                          <span>Supported Generation Models:</span>
                          <span className="font-mono text-[#02F7C8] text-xs font-bold">
                            {providerEntry.staticModels.length} verified
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {providerEntry.staticModels.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs font-mono font-medium px-2 py-0.5 rounded-lg bg-white/[0.06] text-zinc-200 border border-white/[0.1]"
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
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(3,135,254,0.35)] flex items-center justify-center gap-2 cursor-pointer mt-0.5"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Validating Key &amp; Fetching Models…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
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
                    className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl bg-[#121217] border border-white/[0.12] shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
                        <span className="text-sm font-bold text-white">
                          Active Model &bull; {providerEntry?.name || selectedProvider}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/[0.12] text-zinc-100">
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
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-zinc-100 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Disconnect key and reset"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Change</span>
                        </motion.button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs sm:text-sm font-semibold text-zinc-200">
                        Select generation model for workflows &amp; auditing:
                      </label>
                      <select
                        value={activeModel}
                        onChange={(e) => handleModelSelect(e.target.value)}
                        className="w-full h-10 px-3.5 py-2 rounded-xl bg-[#181820] border border-white/[0.15] hover:border-white/[0.25] text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200 cursor-pointer"
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
              <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl bg-[#121217] border border-white/[0.12] shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Schema Target
                  </span>
                  <span className="text-xs font-mono text-[#01B6FE] font-medium">n8n syntax version</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPrefs((prev) => ({ ...prev, targetVersion: 'v1' }))
                    }
                    className={`p-3 rounded-xl border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer min-h-[58px] ${
                      prefs.targetVersion === 'v1'
                        ? 'border-2 border-[#01B6FE] bg-[#01B6FE]/20 text-white ring-2 ring-[#01B6FE]/30 shadow-[0_0_20px_rgba(1,182,254,0.25)] font-bold'
                        : 'border border-white/[0.12] bg-[#181820] text-zinc-200 hover:text-white hover:border-white/[0.25]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold text-white">n8n v1.x (Modern)</span>
                    <span className="text-xs text-sky-200 font-medium">UUIDs &amp; typeVersions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrefs((prev) => ({ ...prev, targetVersion: 'v0' }))
                    }
                    className={`p-3 rounded-xl border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer min-h-[58px] ${
                      prefs.targetVersion === 'v0'
                        ? 'border-2 border-[#01B6FE] bg-[#01B6FE]/20 text-white ring-2 ring-[#01B6FE]/30 shadow-[0_0_20px_rgba(1,182,254,0.25)] font-bold'
                        : 'border border-white/[0.12] bg-[#181820] text-zinc-200 hover:text-white hover:border-white/[0.25]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-semibold text-white">n8n v0.x (Legacy)</span>
                    <span className="text-xs text-zinc-300 font-medium">Numeric node IDs</span>
                  </button>
                </div>
              </div>

              {/* Serverless engine status */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#121217] border border-white/[0.12] shadow-sm text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-100 font-medium">
                    {hasKey ? 'Personal key active (browser encrypted)' : cloudEngineActive ? 'Serverless cloud engine active' : 'API key required'}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#02F7C8] font-bold px-2 py-0.5 rounded bg-[#02F7C8]/10 border border-[#02F7C8]/25">
                  Vercel Edge
                </span>
              </div>
            </div>

            {/* Right Column: Canvas & Generation Rules */}
            <div className="flex flex-col gap-3 p-3.5 sm:p-4 rounded-xl bg-[#121217] border border-white/[0.12] shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Canvas &amp; Generation Rules
                </span>
                <span className="text-xs font-mono text-[#01B6FE] font-medium">Formatting</span>
              </div>

              {/* Error handling strategy */}
              <div className="flex flex-col gap-1">
                <label className="text-xs sm:text-sm font-semibold text-white flex items-center justify-between">
                  <span>Default Node Error Handling</span>
                  <span className="text-xs text-zinc-200 font-mono font-semibold bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1]">
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
                  className="w-full h-10 px-3.5 py-2 rounded-xl bg-[#181820] border border-white/[0.15] hover:border-white/[0.25] text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200 cursor-pointer"
                >
                  <option value="none">Strict (Stop on error)</option>
                  <option value="continue">Resilient (Continue execution on failure)</option>
                  <option value="retry">Auto-Retry (Retry failed action nodes 3x)</option>
                </select>
              </div>

              {/* Layout Spacing Segmented Control */}
              <div className="flex flex-col gap-1">
                <label className="text-xs sm:text-sm font-semibold text-white flex items-center justify-between">
                  <span>Canvas Node Spacing</span>
                  <span className="text-xs text-zinc-200 font-mono font-semibold bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1]">
                    {prefs.layoutSpacing === 180
                      ? 'Compact (180px)'
                      : prefs.layoutSpacing === 280
                      ? 'Spacious (280px)'
                      : 'Standard (220px)'}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
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
                      className={`h-9 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        prefs.layoutSpacing === item.val
                          ? 'bg-[#01B6FE]/20 border-2 border-[#01B6FE] text-white shadow-[0_0_15px_rgba(1,182,254,0.3)] ring-1 ring-[#01B6FE]/40'
                          : 'bg-[#181820] border border-white/[0.12] text-zinc-200 hover:text-white hover:border-white/[0.25]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Schedule Timezone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs sm:text-sm font-semibold text-white flex items-center justify-between">
                  <span>Default Schedule Timezone</span>
                  <span className="text-xs text-zinc-200 font-mono font-semibold bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1]">
                    {prefs.timezone || 'UTC'}
                  </span>
                </label>
                <select
                  value={prefs.timezone || 'UTC'}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  className="w-full h-10 px-3.5 py-2 rounded-xl bg-[#181820] border border-white/[0.15] hover:border-white/[0.25] text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200 cursor-pointer"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom styled checkboxes */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="pr-3">
                  <span className="text-xs sm:text-sm text-white font-semibold block">
                    Inject Sample Mock Payloads (pinData)
                  </span>
                  <span className="text-xs text-zinc-200 block mt-0.5 leading-relaxed">
                    Add sample data on trigger nodes for instant testing
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.injectPinData}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, injectPinData: e.target.checked }))
                  }
                  className="w-4.5 h-4.5 rounded border-2 border-white/30 checked:bg-[#01B6FE] checked:border-[#01B6FE] text-[#01B6FE] accent-[#01B6FE] focus:ring-4 focus:ring-[#01B6FE]/15 cursor-pointer transition-all duration-200 flex-shrink-0"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="pr-3">
                  <span className="text-xs sm:text-sm text-white font-semibold block">
                    Auto-add Canvas Sticky Note
                  </span>
                  <span className="text-xs text-zinc-200 block mt-0.5 leading-relaxed">
                    Place an annotated sticky note describing the flow
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.addStickyNote}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, addStickyNote: e.target.checked }))
                  }
                  className="w-4.5 h-4.5 rounded border-2 border-white/30 checked:bg-[#01B6FE] checked:border-[#01B6FE] text-[#01B6FE] accent-[#01B6FE] focus:ring-4 focus:ring-[#01B6FE]/15 cursor-pointer transition-all duration-200 flex-shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.1]">
            <span className="text-xs sm:text-sm text-zinc-300 font-mono font-medium hidden sm:inline">
              Op8n Studio Engine
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] text-zinc-100 hover:text-white transition-colors duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white shadow-[0_0_22px_rgba(3,135,254,0.45)] hover:shadow-[0_0_30px_rgba(117,1,253,0.65)] transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
