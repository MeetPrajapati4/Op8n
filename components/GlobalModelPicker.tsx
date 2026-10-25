'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Cpu, ChevronDown, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  hasUserApiKey,
  getUserProvider,
  getUserModels,
  getUserActiveModel,
  setUserActiveModel,
  onUserKeyChange,
} from '@/lib/client/user-keys';
import { getProviderEntry } from '@/lib/registry/providers';
import { filterSuitableWorkflowModels } from '@/lib/registry/model-filter';

export interface ActiveModelSelection {
  provider: string;
  model: string;
}

const STORAGE_KEY = 'op8n_active_model';
const DEFAULT_MODEL_SELECTION: ActiveModelSelection = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
};

export function getStoredModelSelection(): ActiveModelSelection {
  if (typeof window === 'undefined') {
    return DEFAULT_MODEL_SELECTION;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && parsed.model) {
        // Auto-heal retired gemini-1.5-pro in storage
        if (parsed.model === 'gemini-1.5-pro') {
          parsed.model = 'gemini-2.5-flash';
          saveStoredModelSelection(parsed);
        }
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return DEFAULT_MODEL_SELECTION;
}

export function saveStoredModelSelection(selection: ActiveModelSelection): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore
  }
}

interface GlobalModelPickerProps {
  className?: string;
  value?: ActiveModelSelection;
  onChange?: (selection: ActiveModelSelection) => void;
}

export default function GlobalModelPicker({
  className = '',
  value,
  onChange,
}: GlobalModelPickerProps) {
  // Use a constant initial state for SSR matching to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [selection, setSelection] = useState<ActiveModelSelection>(
    value || DEFAULT_MODEL_SELECTION
  );
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Load models: strictly filtered for n8n workflow generation and JSON auditing
  const loadDynamicModels = useCallback(() => {
    if (hasUserApiKey()) {
      const p = getUserProvider();
      const rawUserModels = getUserModels();
      const userModels = filterSuitableWorkflowModels(rawUserModels);
      const currentActive = getUserActiveModel();

      if (userModels.length > 0) {
        setAvailableModels(userModels);
        const activeExists = userModels.some((m) => m.id === currentActive);
        const resolvedModel = activeExists ? currentActive : userModels[0].id;
        const sel = { provider: p, model: resolvedModel };
        setSelection(sel);
        return;
      }
    }

    // Fallback to server registry models if no custom key yet
    const currentProvider = selection.provider || 'gemini';
    const reg = getProviderEntry(currentProvider);
    const rawStatic = reg?.staticModels || [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ];
    const filteredStatic = filterSuitableWorkflowModels(rawStatic);
    setAvailableModels(filteredStatic);
  }, [selection.provider]);

  // On client mount, load stored selection and dynamic models
  useEffect(() => {
    setMounted(true);
    const stored = getStoredModelSelection();
    if (!value) {
      setSelection(stored);
    }
  }, [value]);

  useEffect(() => {
    if (mounted) {
      loadDynamicModels();
    }
  }, [mounted, loadDynamicModels]);

  // Listen to key changes from Preferences
  useEffect(() => {
    return onUserKeyChange(() => {
      loadDynamicModels();
    });
  }, [loadDynamicModels]);

  // Sync external value prop
  useEffect(() => {
    if (value) {
      setSelection((prev) => {
        if (prev.provider === value.provider && prev.model === value.model) {
          return prev;
        }
        return value;
      });
    }
  }, [value?.provider, value?.model]);

  const handleSelectModel = (modelId: string) => {
    const newSelection = { provider: selection.provider, model: modelId };
    setSelection(newSelection);
    saveStoredModelSelection(newSelection);
    setUserActiveModel(selection.provider, modelId);
    onChangeRef.current?.(newSelection);
    setIsOpen(false);
  };

  const providerEntry = getProviderEntry(selection.provider);
  const isUserConfigured = mounted && hasUserApiKey();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/[0.08] bg-[#141416] text-sm font-medium text-zinc-200 hover:border-[#FF6D5A]/60 hover:text-white focus:outline-none focus:border-[#FF6D5A]/60 focus:ring-4 focus:ring-[#FF6D5A]/10 transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98] cursor-pointer ${className}`}
          title="Active Model Selection"
        >
          <Cpu className="w-4 h-4 text-[#FF6D5A] flex-shrink-0" />
          <div className="flex items-center gap-2 truncate max-w-[210px]">
            <span suppressHydrationWarning className="font-semibold text-zinc-200">
              {providerEntry?.name || selection.provider}
            </span>
            <span className="text-zinc-600">&bull;</span>
            <span
              suppressHydrationWarning
              className="font-mono text-sm text-[#FF6D5A] truncate"
            >
              {selection.model}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        data-lenis-prevent="true"
        className="w-[300px] p-0 bg-[#0C0C0F]/95 backdrop-blur-xl border border-white/[0.08] text-zinc-100 shadow-2xl rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-3 border-b border-white/[0.07] bg-[#141416]/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className={`w-2 h-2 rounded-full ${
                isUserConfigured ? 'bg-emerald-400' : 'bg-[#FF6D5A]'
              }`}
            />
            <span>{providerEntry?.name || 'AI'} Models</span>
          </div>
          <span className="text-sm text-zinc-400 font-mono">
            {availableModels.length} permitted
          </span>
        </div>

        {/* Clean Model List */}
        <div className="max-h-[260px] overflow-y-auto p-2 flex flex-col gap-1 overscroll-contain">
          {availableModels.map((m) => {
            const isSelected = m.id === selection.model;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectModel(m.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF6D5A]/15 border border-[#FF6D5A]/40 text-white font-medium'
                    : 'hover:bg-[#1a1a20] text-zinc-300 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="text-sm truncate font-medium">{m.name || m.id}</span>
                  <span className="text-sm font-mono text-zinc-400 truncate">
                    {m.id}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-[#FF6D5A] flex-shrink-0" />
                )}
              </button>
            );
          })}

          {availableModels.length === 0 && (
            <div className="py-4 text-center text-sm text-zinc-400">
              No models available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
