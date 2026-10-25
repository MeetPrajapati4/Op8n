'use client';

/**
 * Per-User "Write-Once, Auto-Hide" Client Vault
 *
 * Stores user API keys obfuscated strictly in client-side storage.
 * Keys are never rendered in plain text in the DOM or in HTML attributes.
 * Dispatches events on save, purge, or model switch.
 */

import { filterSuitableWorkflowModels, isSuitableWorkflowModel } from '../registry/model-filter';

export interface UserSavedModel {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface ActiveModelSelection {
  provider: string;
  model: string;
}

const STORAGE_KEY_OBFUSCATED = 'op8n_vault_k';
const STORAGE_KEY_PROVIDER = 'op8n_vault_p';
const STORAGE_KEY_MODELS = 'op8n_vault_models';
const STORAGE_KEY_ACTIVE_MODEL = 'op8n_active_model';
const EVENT_KEY_CHANGE = 'op8n_user_key_change';

// Obfuscation seed to prevent plain-text key inspection in raw storage dumps
const SALT = 0x5a;

function obfuscate(plaintext: string): string {
  try {
    const chars = Array.from(plaintext).map((c) =>
      String.fromCharCode(c.charCodeAt(0) ^ SALT)
    );
    return btoa(chars.join(''));
  } catch {
    return plaintext;
  }
}

function deobfuscate(encoded: string): string {
  try {
    const raw = atob(encoded);
    return Array.from(raw)
      .map((c) => String.fromCharCode(c.charCodeAt(0) ^ SALT))
      .join('');
  } catch {
    return '';
  }
}

/**
 * Detect provider from key prefix conventions
 */
export function detectProviderFromKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) return 'gemini';
  if (trimmed.startsWith('sk-ant-')) return 'anthropic';
  if (trimmed.startsWith('sk-or-')) return 'openrouter';
  if (trimmed.startsWith('gsk_')) return 'groq';
  if (trimmed.startsWith('xai-')) return 'xai';
  if (trimmed.startsWith('fw-') || trimmed.startsWith('fw_')) return 'fireworks';
  if (trimmed.startsWith('nvapi-')) return 'nvidia';
  if (trimmed.startsWith('co-')) return 'cohere';
  if (trimmed.startsWith('pplx-')) return 'perplexity';
  if (trimmed.startsWith('sk-')) return 'openai';
  return 'openai';
}

/**
 * Check if the current user has a stored API key
 */
export function hasUserApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OBFUSCATED);
    return Boolean(raw && raw.length > 5);
  } catch {
    return false;
  }
}

/**
 * Retrieve the deobfuscated API key in memory (never rendered to DOM)
 */
export function getUserApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OBFUSCATED);
    if (!raw) return null;
    const deob = deobfuscate(raw);
    return deob || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve user's configured provider
 */
export function getUserProvider(): string {
  if (typeof window === 'undefined') return 'gemini';
  try {
    return localStorage.getItem(STORAGE_KEY_PROVIDER) || 'gemini';
  } catch {
    return 'gemini';
  }
}

/**
 * Retrieve user's dynamically fetched permitted models, filtered for workflow generation
 */
export function getUserModels(): UserSavedModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODELS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return filterSuitableWorkflowModels(list).map((m) => ({
      id: m.id,
      name: m.name || m.id,
      contextWindow: m.contextWindow,
    }));
  } catch {
    return [];
  }
}

/**
 * Retrieve user's currently selected active model
 */
export function getUserActiveModel(): string {
  if (typeof window === 'undefined') return 'gemini-2.5-flash';
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_MODEL);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.model) {
        if (parsed.model === 'gemini-1.5-pro') {
          return 'gemini-2.5-flash';
        }
        if (isSuitableWorkflowModel(parsed.model)) {
          return parsed.model;
        }
      }
    }
  } catch {
    // Ignore
  }
  return 'gemini-2.5-flash';
}

/**
 * Save user API key, provider, and dynamically fetched models.
 * Once saved, UI will unmount the input section and show dynamic models.
 */
export function setUserApiKey(
  apiKey: string,
  provider: string,
  models: UserSavedModel[],
  defaultModel?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanKey = apiKey.trim();
    localStorage.setItem(STORAGE_KEY_OBFUSCATED, obfuscate(cleanKey));
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(models));

    const selectedModel = defaultModel || models[0]?.id || 'default';
    localStorage.setItem(
      STORAGE_KEY_ACTIVE_MODEL,
      JSON.stringify({ provider, model: selectedModel })
    );

    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_KEY_CHANGE, {
          detail: { hasKey: true, provider, models, activeModel: selectedModel },
        })
      );
    }
  } catch (err) {
    console.error('Failed to save user credentials', err);
  }
}

/**
 * Set active model selection
 */
export function setUserActiveModel(modelOrProvider: string, maybeModel?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const provider = maybeModel ? modelOrProvider : getUserProvider();
    const model = maybeModel || modelOrProvider;
    localStorage.setItem(
      STORAGE_KEY_ACTIVE_MODEL,
      JSON.stringify({ provider, model })
    );
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_KEY_CHANGE, {
          detail: { hasKey: hasUserApiKey(), provider, activeModel: model },
        })
      );
    }
  } catch {
    // Ignore
  }
}

/**
 * Purge invalid or expired key from storage
 * Triggered automatically on HTTP 401 or Invalid Key error
 */
export function purgeUserApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_OBFUSCATED);
    localStorage.removeItem(STORAGE_KEY_PROVIDER);
    localStorage.removeItem(STORAGE_KEY_MODELS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_MODEL);
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EVENT_KEY_CHANGE, {
          detail: { hasKey: false, purged: true },
        })
      );
    }
  } catch {
    // Ignore
  }
}

/**
 * Listen for user key and model changes
 */
export function onUserKeyChange(callback: (e: CustomEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => callback(event as CustomEvent);
  window.addEventListener(EVENT_KEY_CHANGE, handler);
  return () => {
    window.removeEventListener(EVENT_KEY_CHANGE, handler);
  };
}
