export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama';

export interface ProviderOption {
  id: AIProvider;
  name: string;
  defaultModel: string;
  models: string[];
  placeholderKey: string;
  keyUrl?: string;
  requiresKey: boolean;
  needsBaseUrl?: boolean;
}

export const PROVIDERS: Record<AIProvider, ProviderOption> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    placeholderKey: 'AIzaSy...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    requiresKey: false, // Can fall back to server env if not provided
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    placeholderKey: 'sk-proj-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-7-sonnet-20250219',
    ],
    placeholderKey: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'google/gemini-2.0-flash-001',
    models: [
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-haiku',
      'meta-llama/llama-3.3-70b-instruct',
      'mistralai/mistral-large-2411',
    ],
    placeholderKey: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    requiresKey: true,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5-coder', 'mistral', 'deepseek-r1:8b', 'codellama'],
    placeholderKey: 'None required',
    requiresKey: false,
    needsBaseUrl: true,
  },
};

export interface UserAISettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const STORAGE_KEY = 'op8n_ai_settings';

export function getStoredSettings(): UserAISettings {
  if (typeof window === 'undefined') {
    return {
      provider: 'gemini',
      model: PROVIDERS.gemini.defaultModel,
      apiKey: '',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && PROVIDERS[parsed.provider as AIProvider]) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return {
    provider: 'gemini',
    model: PROVIDERS.gemini.defaultModel,
    apiKey: '',
  };
}

export function saveStoredSettings(settings: UserAISettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
  }
}
