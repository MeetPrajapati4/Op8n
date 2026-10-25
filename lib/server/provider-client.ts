import { PROVIDER_REGISTRY, ModelInfo, getProviderEntry } from '../registry/providers';
import { filterSuitableWorkflowModels } from '../registry/model-filter';
import { sanitizeClientError } from './crypto';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Fetches live models from provider API using the registry adapter.
 * Handles timeouts, network errors, and redacts sensitive error details.
 */
export async function fetchLiveModelsFromProvider(
  providerId: string,
  apiKey: string,
  customBaseUrl?: string
): Promise<ModelInfo[]> {
  const reg = getProviderEntry(providerId);
  if (!reg) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  // If provider has no listModelsPath (e.g. Perplexity), return static models
  if (!reg.listModelsPath) {
    return reg.staticModels || [];
  }

  const baseUrl = (customBaseUrl?.trim() || reg.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error(`Base URL is missing for provider: ${providerId}`);
  }

  const endpoint = `${baseUrl}${reg.listModelsPath}`;
  const headers = reg.authHeaderBuilder(apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errSummary = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errSummary = errJson?.error?.message || errJson?.message || errSummary;
      } catch {
        // ignore json parse error
      }

      if (res.status === 401 || res.status === 403) {
        throw new Error('Provider authentication failed: Invalid or inactive API key');
      }
      if (res.status === 429) {
        throw new Error('Provider rate limit reached. Please try again later.');
      }
      if (res.status === 404) {
        // For custom baseUrl, try fallback from /v1/models to /models or vice versa
        if (reg.id === 'custom') {
          return await tryCustomFallback(baseUrl, headers);
        }
        throw new Error('Provider endpoint not found.');
      }

      throw new Error(`Provider returned error (${res.status}): ${errSummary}`);
    }

    const data = await res.json();
    const rawModels = reg.parseModels(data);
    const models = filterSuitableWorkflowModels(rawModels);

    if (models.length === 0 && reg.staticModels && reg.staticModels.length > 0) {
      return reg.staticModels;
    }

    return models.length > 0 ? models : rawModels;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Connection timed out while contacting provider.');
      }
      // Re-throw sanitized error message
      const sanitized = sanitizeClientError(err, err.message);
      throw new Error(sanitized);
    }
    throw new Error('Failed to fetch models from provider.');
  }
}

/**
 * Fallback probe for custom OpenAI-compatible endpoints that might be on /v1/models or /models
 */
async function tryCustomFallback(baseUrl: string, headers: Record<string, string>): Promise<ModelInfo[]> {
  const altPath = baseUrl.endsWith('/v1') ? '/models' : '/v1/models';
  const altUrl = `${baseUrl}${altPath}`;
  try {
    const res = await fetch(altUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
    });
    if (res.ok) {
      const data = await res.json();
      const customReg = getProviderEntry('custom');
      return customReg ? customReg.parseModels(data) : [];
    }
  } catch {
    // ignore
  }
  return [
    { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000 },
    { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', contextWindow: 32768 },
    { id: 'deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000 },
  ];
}

/**
 * Tests connection to a provider with the given key.
 */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
  baseUrl?: string
): Promise<{ ok: boolean; modelCount: number; message: string }> {
  const reg = getProviderEntry(providerId);
  if (!reg) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  // For Perplexity (which has no list endpoint), test with a quick lightweight completion probe
  if (providerId === 'perplexity') {
    return await testPerplexityKey(apiKey);
  }

  const models = await fetchLiveModelsFromProvider(providerId, apiKey, baseUrl);
  return {
    ok: true,
    modelCount: models.length,
    message: `Connected successfully. ${models.length} model${models.length === 1 ? '' : 's'} available.`,
  };
}

async function testPerplexityKey(apiKey: string): Promise<{ ok: boolean; modelCount: number; message: string }> {
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Provider authentication failed: Invalid API key');
    }

    const reg = getProviderEntry('perplexity');
    const count = reg?.staticModels?.length || 5;
    return {
      ok: true,
      modelCount: count,
      message: `Connected successfully to Perplexity. ${count} models ready.`,
    };
  } catch (err: unknown) {
    const sanitized = sanitizeClientError(err, 'Failed to connect to Perplexity');
    throw new Error(sanitized);
  }
}

/**
 * Universal proxy for streaming completions to any provider.
 * Normalizes chunks to Server-Sent Events with `{ text: string }`.
 */
export async function createProviderChatStream(
  providerId: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  customBaseUrl?: string
): Promise<ReadableStream<Uint8Array>> {
  const reg = getProviderEntry(providerId);
  if (!reg) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const effectiveBaseUrl = (customBaseUrl?.trim() || reg.baseUrl || '').replace(/\/+$/, '');
  const headers = reg.authHeaderBuilder(apiKey);

  const encoder = new TextEncoder();

  // 1. Anthropic Claude Messages API
  if (providerId === 'anthropic') {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        system: systemMessage,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(await formatProviderHttpError(res));
    }

    return createAnthropicSseStream(res.body!);
  }

  // 2. Google Gemini Stream
  if (providerId === 'gemini') {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const bodyPayload: any = { contents };
    if (systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const cleanModel = model.replace(/^models\//, '');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse`;

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      throw new Error(await formatProviderHttpError(res));
    }

    return createGeminiSseStream(res.body!);
  }

  // 3. OpenAI-compatible / Standard REST Stream
  // Covers: openai, openrouter, groq, mistral, together, deepseek, xai, fireworks, cohere, perplexity, custom
  let completionEndpoint = `${effectiveBaseUrl}/chat/completions`;
  if (providerId === 'custom' && !effectiveBaseUrl.endsWith('/v1')) {
    // If user provided base URL like http://localhost:11434, support http://localhost:11434/v1/chat/completions
    completionEndpoint = `${effectiveBaseUrl}/v1/chat/completions`;
  }

  const res = await fetch(completionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    // If custom failed with 404, try root /chat/completions
    if (res.status === 404 && providerId === 'custom') {
      const fallbackRes = await fetch(`${effectiveBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (fallbackRes.ok) {
        return createOpenAiSseStream(fallbackRes.body!);
      }
    }
    throw new Error(await formatProviderHttpError(res));
  }

  return createOpenAiSseStream(res.body!);
}

async function formatProviderHttpError(res: Response): Promise<string> {
  let detail = `Status ${res.status}`;
  try {
    const json = await res.json();
    detail = json?.error?.message || json?.message || detail;
  } catch {
    // ignore
  }
  if (res.status === 401 || res.status === 403) {
    return 'Provider authentication failed: Invalid API key';
  }
  if (res.status === 429) {
    return 'Provider rate limit exceeded. Please try again later.';
  }
  return `Provider error (${res.status}): ${detail}`;
}

function createOpenAiSseStream(sourceBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = sourceBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') {
            controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
            controller.close();
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const deltaText = parsed.choices?.[0]?.delta?.content || '';
            if (deltaText) {
              controller.enqueue(
                encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: deltaText })}\n\n`)
              );
            }
          } catch {
            // ignore non-json lines
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function createAnthropicSseStream(sourceBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = sourceBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              controller.enqueue(
                encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
              );
            } else if (parsed.type === 'message_stop') {
              controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
              controller.close();
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function createGeminiSseStream(sourceBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = sourceBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();

          try {
            const parsed = JSON.parse(dataStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              controller.enqueue(
                encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`)
              );
            }
          } catch {
            // ignore
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

/**
 * Execute non-streaming chat completion across any provider and return full text
 */
export async function executeProviderChat(
  providerId: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  customBaseUrl?: string
): Promise<string> {
  const stream = await createProviderChatStream(
    providerId,
    apiKey,
    model,
    messages,
    customBaseUrl
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let sseBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.text) {
            fullText += parsed.text;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return fullText;
}

