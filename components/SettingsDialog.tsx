'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AIProvider,
  PROVIDERS,
  UserAISettings,
  getStoredSettings,
  saveStoredSettings,
} from '@/lib/providers';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (settings: UserAISettings) => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<UserAISettings>(getStoredSettings());
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setSettings(getStoredSettings());
    }
  }, [open]);

  const currentProviderInfo = PROVIDERS[settings.provider] || PROVIDERS.gemini;

  const handleProviderChange = (newProvider: AIProvider) => {
    const prov = PROVIDERS[newProvider];
    setSettings((prev) => ({
      ...prev,
      provider: newProvider,
      model: prov.defaultModel,
      baseUrl: newProvider === 'ollama' ? prev.baseUrl || 'http://localhost:11434' : undefined,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSettings(settings);
    toast.success('AI provider settings saved!');
    onSaved?.(settings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-[#18181b] border-[#2e2e35] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            AI Provider &amp; Model
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Configure your AI provider or Bring Your Own Key (BYOK).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4 mt-2">
          {/* Provider Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Provider
            </label>
            <select
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-sm text-zinc-200 focus:outline-none focus:border-[#FF6D5A] focus:ring-1 focus:ring-[#FF6D5A]"
            >
              {Object.values(PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Model
            </label>
            <div className="flex gap-2">
              <select
                value={settings.model}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, model: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-sm text-zinc-200 focus:outline-none focus:border-[#FF6D5A] focus:ring-1 focus:ring-[#FF6D5A]"
              >
                {currentProviderInfo.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ollama Base URL if selected */}
          {settings.provider === 'ollama' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={settings.baseUrl || 'http://localhost:11434'}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-sm text-zinc-200 focus:outline-none focus:border-[#FF6D5A] focus:ring-1 focus:ring-[#FF6D5A]"
              />
            </div>
          )}

          {/* API Key */}
          {settings.provider !== 'ollama' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">
                  {currentProviderInfo.name} API Key
                </label>
                {currentProviderInfo.keyUrl && (
                  <a
                    href={currentProviderInfo.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#FF6D5A] hover:underline flex items-center gap-1"
                  >
                    Get API key <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder={
                    settings.provider === 'gemini'
                      ? 'Leave blank to use default server key'
                      : currentProviderInfo.placeholderKey
                  }
                  className="w-full pr-10 pl-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A] focus:ring-1 focus:ring-[#FF6D5A]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Security guarantee note */}
          <div className="p-2.5 rounded-lg bg-[#111113] border border-[#2e2e35] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-400 leading-tight">
              <strong>BYOK Security:</strong> Keys remain stored exclusively in your browser&apos;s <code className="text-zinc-300 font-mono">localStorage</code> and are forwarded only in HTTP headers. Never logged, cached, or returned to clients.
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-[#2e2e35] text-zinc-300 hover:bg-[#27272a] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 transition-opacity"
            >
              Save Settings
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
