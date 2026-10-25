export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  description?: string;
}

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  baseUrl: string;
  authHeaderBuilder: (apiKey: string) => Record<string, string>;
  listModelsPath: string;
  parseModels: (response: any) => ModelInfo[];
  staticModels?: ModelInfo[];
  requiresBaseUrl?: boolean;
  defaultModel?: string;
  docsUrl?: string;
  keyPlaceholder?: string;
}

export const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  // 1. Anthropic (Claude)
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    authHeaderBuilder: (apiKey: string) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.display_name || m.id || ''),
        contextWindow: 200000,
      }));
    },
    staticModels: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextWindow: 200000 },
    ],
    defaultModel: 'claude-3-7-sonnet-20250219',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
  },

  // 2. OpenAI
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items
        .filter((m: any) => {
          const id = String(m.id || '').toLowerCase();
          // Prefer generative models, skip legacy whisper/dall-e/tts/embedding if listing
          return (
            id.startsWith('gpt-') ||
            id.startsWith('o1') ||
            id.startsWith('o3') ||
            id.startsWith('chatgpt-')
          );
        })
        .map((m: any) => ({
          id: String(m.id || ''),
          name: String(m.id || ''),
          contextWindow: String(m.id).includes('o3') || String(m.id).includes('o1') ? 200000 : 128000,
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
    },

    staticModels: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'o3-mini', name: 'o3-mini', contextWindow: 200000 },
      { id: 'o1', name: 'o1', contextWindow: 200000 },
    ],
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
  },

  // 3. OpenRouter
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://op8n.app',
      'X-Title': 'Op8n Studio',
    }),
    listModelsPath: '/api/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.name || m.id || ''),
        contextWindow: typeof m.context_length === 'number' ? m.context_length : undefined,
        description: typeof m.description === 'string' ? m.description.slice(0, 100) : undefined,
      }));
    },
    staticModels: [
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', contextWindow: 1048576 },
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', contextWindow: 200000 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000 },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', contextWindow: 128000 },
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', contextWindow: 32768 },
    ],
    defaultModel: 'google/gemini-2.0-flash-001',
    docsUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-...',
  },

  // 4. NVIDIA NIM
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.id || ''),
        contextWindow: 128000,
      }));
    },
    staticModels: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'meta/llama-3.3-70b-instruct', contextWindow: 128000 },
      { id: 'mistralai/mistral-large-2-instruct', name: 'mistralai/mistral-large-2-instruct', contextWindow: 128000 },
      { id: 'deepseek-ai/deepseek-r1', name: 'deepseek-ai/deepseek-r1', contextWindow: 64000 },
    ],
    defaultModel: 'meta/llama-3.3-70b-instruct',
    docsUrl: 'https://build.nvidia.com',
    keyPlaceholder: 'nvapi-...',
  },

  // 5. Google Gemini
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authHeaderBuilder: (apiKey: string) => ({
      'x-goog-api-key': apiKey,
    }),
    listModelsPath: '/v1beta/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.models) ? response.models : [];
      return items
        .filter((m: any) => {
          const methods = m.supportedGenerationMethods || [];
          return methods.includes('generateContent');
        })
        .map((m: any) => {
          const rawName = String(m.name || '');
          const cleanId = rawName.replace(/^models\//, '');
          return {
            id: cleanId,
            name: String(m.displayName || cleanId),
            contextWindow: typeof m.inputTokenLimit === 'number' ? m.inputTokenLimit : undefined,
          };
        });
    },
    staticModels: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1048576 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2097152 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1048576 },
    ],
    defaultModel: 'gemini-2.5-flash',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
  },

  // 6. Groq
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/openai/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items
        .filter((m: any) => m.active !== false)
        .map((m: any) => ({
          id: String(m.id || ''),
          name: String(m.id || ''),
          contextWindow: typeof m.context_window === 'number' ? m.context_window : undefined,
        }));
    },
    staticModels: [
      { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile', contextWindow: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'llama-3.1-8b-instant', contextWindow: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'mixtral-8x7b-32768', contextWindow: 32768 },
      { id: 'deepseek-r1-distill-llama-70b', name: 'deepseek-r1-distill-llama-70b', contextWindow: 128000 },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    docsUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
  },

  // 7. Mistral
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.name || m.id || ''),
        contextWindow: typeof m.max_context_length === 'number' ? m.max_context_length : 128000,
      }));
    },
    staticModels: [
      { id: 'mistral-large-latest', name: 'Mistral Large Latest', contextWindow: 128000 },
      { id: 'mistral-small-latest', name: 'Mistral Small Latest', contextWindow: 128000 },
      { id: 'codestral-latest', name: 'Codestral Latest', contextWindow: 256000 },
    ],
    defaultModel: 'mistral-large-latest',
    docsUrl: 'https://console.mistral.ai/api-keys',
    keyPlaceholder: '...',
  },

  // 8. Together AI
  together: {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.display_name || m.id || ''),
        contextWindow: typeof m.context_length === 'number' ? m.context_length : undefined,
      }));
    },
    staticModels: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Instruct Turbo', contextWindow: 131072 },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', contextWindow: 65536 },
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B Instruct', contextWindow: 32768 },
    ],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    docsUrl: 'https://api.together.ai/settings/api-keys',
    keyPlaceholder: '...',
  },

  // 9. DeepSeek
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => {
        const id = String(m.id || '');
        let name = id;
        if (id === 'deepseek-chat') name = 'DeepSeek V3 (Chat)';
        if (id === 'deepseek-reasoner') name = 'DeepSeek R1 (Reasoner)';
        return {
          id,
          name,
          contextWindow: 64000,
        };
      });
    },
    staticModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', contextWindow: 64000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', contextWindow: 64000 },
    ],
    defaultModel: 'deepseek-chat',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
  },

  // 10. xAI (Grok)
  xai: {
    id: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => ({
        id: String(m.id || ''),
        name: String(m.id || ''),
        contextWindow: 131072,
      }));
    },
    staticModels: [
      { id: 'grok-2-latest', name: 'Grok 2 Latest', contextWindow: 131072 },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', contextWindow: 32768 },
    ],
    defaultModel: 'grok-2-latest',
    docsUrl: 'https://console.x.ai',
    keyPlaceholder: 'xai-...',
  },

  // 11. Fireworks AI
  fireworks: {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/inference/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.data) ? response.data : [];
      return items.map((m: any) => {
        const id = String(m.id || '');
        const cleanName = id.split('/').pop() || id;
        return {
          id,
          name: cleanName,
          contextWindow: typeof m.context_length === 'number' ? m.context_length : 128000,
        };
      });
    },
    staticModels: [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B Instruct', contextWindow: 131072 },
      { id: 'accounts/fireworks/models/deepseek-r1', name: 'DeepSeek R1', contextWindow: 131072 },
      { id: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', contextWindow: 32768 },
    ],
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    docsUrl: 'https://fireworks.ai/account/api-keys',
    keyPlaceholder: 'fw_...',
  },

  // 12. Cohere
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '/v1/models',
    parseModels: (response: any) => {
      const items = Array.isArray(response?.models) ? response.models : [];
      return items
        .filter((m: any) => !m.endpoints || m.endpoints.includes('chat'))
        .map((m: any) => ({
          id: String(m.name || ''),
          name: String(m.name || ''),
          contextWindow: typeof m.context_length === 'number' ? m.context_length : 128000,
        }));
    },
    staticModels: [
      { id: 'command-r-plus-08-2024', name: 'Command R+ (08-2024)', contextWindow: 128000 },
      { id: 'command-r-08-2024', name: 'Command R (08-2024)', contextWindow: 128000 },
      { id: 'command-r-plus', name: 'Command R+', contextWindow: 128000 },
      { id: 'command-r', name: 'Command R', contextWindow: 128000 },
    ],
    defaultModel: 'command-r-plus-08-2024',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    keyPlaceholder: '...',
  },

  // 13. Perplexity (no list endpoint, static fallback list)
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    authHeaderBuilder: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    listModelsPath: '',
    parseModels: () => [
      { id: 'sonar-pro', name: 'Sonar Pro', contextWindow: 200000 },
      { id: 'sonar', name: 'Sonar', contextWindow: 128000 },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', contextWindow: 128000 },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning', contextWindow: 128000 },
      { id: 'r1-1776', name: 'R1 1776', contextWindow: 128000 },
    ],
    staticModels: [
      { id: 'sonar-pro', name: 'Sonar Pro', contextWindow: 200000 },
      { id: 'sonar', name: 'Sonar', contextWindow: 128000 },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', contextWindow: 128000 },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning', contextWindow: 128000 },
      { id: 'r1-1776', name: 'R1 1776', contextWindow: 128000 },
    ],
    defaultModel: 'sonar-pro',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    keyPlaceholder: 'pplx-...',
  },

  // 14. Custom OpenAI-compatible (Ollama, LM Studio, vLLM, etc.)
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    baseUrl: '',
    requiresBaseUrl: true,
    authHeaderBuilder: (apiKey: string): Record<string, string> =>
      apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    listModelsPath: '/models',

    parseModels: (response: any) => {
      // Handles both OpenAI format { data: [...] } and Ollama format { models: [...] }
      const items = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.models)
        ? response.models
        : [];
      return items.map((m: any) => ({
        id: String(m.id || m.name || ''),
        name: String(m.name || m.id || ''),
        contextWindow: typeof m.context_length === 'number' ? m.context_length : undefined,
      }));
    },
    staticModels: [
      { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000 },
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 32768 },
      { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000 },
    ],
    defaultModel: 'llama3.2',
    keyPlaceholder: 'Optional for local models',
  },
};

export function getProviderEntry(id: string): ProviderRegistryEntry | undefined {
  return PROVIDER_REGISTRY[id];
}

export function getAllProviderEntries(): ProviderRegistryEntry[] {
  return Object.values(PROVIDER_REGISTRY);
}

export function isValidProviderId(id: string): boolean {
  return id in PROVIDER_REGISTRY;
}
