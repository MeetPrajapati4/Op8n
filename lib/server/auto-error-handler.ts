import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeProviderChat, createProviderChatStream } from './provider-client';

/**
 * Autonomous AI Backend Auto Error Recovery Engine
 * Automatically intercepts model 404s, deprecated models, quota limits (429),
 * and unsupported configuration parameters across providers.
 * Retries seamlessly across fallback models with zero human interaction required.
 */

export interface AutoAiOptions {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  requireJson?: boolean;
}

const PROVIDER_FALLBACK_CHAINS: Record<string, string[]> = {
  gemini: [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ],
  mistral: [
    'codestral-latest',
    'mistral-large-latest',
  ],
  xai: [
    'grok-2',
    'grok-beta',
  ],
  perplexity: [
    'sonar-pro',
    'sonar',
  ],
};

/**
 * Clean model ID (removes leading 'models/' from Gemini API paths and redirects retired models)
 */
export function sanitizeModelId(model: string): string {
  if (!model) return 'gemini-2.5-flash';
  const clean = model.trim().replace(/^models\//i, '');
  const lower = clean.toLowerCase();
  // Auto-heal retired/404 Gemini models to supported active models
  if (
    lower === 'gemini-1.5-pro' ||
    lower === 'gemini-1.5-flash' ||
    lower === 'gemini-2.0-flash' ||
    lower === 'gemini-2.5-pro'
  ) {
    return 'gemini-2.5-flash';
  }
  return clean;
}

/**
 * Builds an ordered list of fallback models for autonomous recovery
 */
export function getModelFallbackChain(provider: string, requestedModel: string): string[] {
  const cleanRequested = sanitizeModelId(requestedModel);
  const chain = PROVIDER_FALLBACK_CHAINS[provider.toLowerCase()] || ['gemini-2.5-flash'];
  
  // Put requested model first if valid, followed by the provider's fallback chain
  const result: string[] = [];
  if (cleanRequested) {
    result.push(cleanRequested);
  }
  for (const fallback of chain) {
    if (!result.includes(fallback)) {
      result.push(fallback);
    }
  }
  return result;
}

/**
 * Detects if an error is an authentication error (cannot be auto-recovered with another model)
 */
export function isAuthError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('api_key_invalid') ||
    lower.includes('authentication') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission denied')
  );
}

/**
 * Detects if an error is due to an unavailable, 404, or discontinued model
 */
export function isModelUnavailableError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('no longer available') ||
    lower.includes('does not exist') ||
    lower.includes('is not supported') ||
    lower.includes('unsupported model') ||
    lower.includes('model not accessible') ||
    lower.includes('deprecated') ||
    lower.includes('is not found')
  );
}

/**
 * Detects if an error is due to an unsupported parameter (e.g. thinkingBudget or responseMimeType)
 */
export function isParameterUnsupportedError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('thinking') ||
    lower.includes('responsemimetype') ||
    lower.includes('json mode') ||
    lower.includes('unsupported parameter') ||
    lower.includes('invalid argument') ||
    lower.includes('unknown field')
  );
}

/**
 * Detects rate limits / quotas (429)
 */
export function isRateLimitError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  );
}

/**
 * Executes a single AI prompt autonomously with self-healing fallback and error recovery.
 * Returns clean text output and the model that successfully produced it.
 */
export async function executeSelfHealingAiCall(
  options: AutoAiOptions
): Promise<{ text: string; modelUsed: string; autoRecovered: boolean }> {
  const {
    provider,
    apiKey,
    model: initialModel,
    systemPrompt,
    userPrompt,
    temperature = 0.2,
    maxOutputTokens = 8192,
    requireJson = true,
  } = options;

  const candidateModels = getModelFallbackChain(provider, initialModel);
  let lastError: Error | null = null;
  let didRecover = false;

  for (let i = 0; i < candidateModels.length; i++) {
    const candidateModel = candidateModels[i];

    // Try normal attempt
    try {
      const text = await executeSingleModelCall({
        provider,
        apiKey,
        model: candidateModel,
        systemPrompt,
        userPrompt,
        temperature,
        maxOutputTokens,
        requireJson,
        useAdvancedConfig: true,
      });

      if (i > 0) {
        didRecover = true;
        console.warn(
          `[AutoErrorHandler] Successfully auto-recovered using fallback model "${candidateModel}" (original was "${initialModel}").`
        );
      }

      return { text, modelUsed: candidateModel, autoRecovered: didRecover };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);

      // If it's a fatal Auth error, don't waste time trying other models with same invalid key
      if (isAuthError(msg)) {
        throw lastError;
      }

      // If it's a parameter error on the same model, retry once with relaxed config
      if (isParameterUnsupportedError(msg)) {
        try {
          console.warn(
            `[AutoErrorHandler] Parameter unsupported on "${candidateModel}". Retrying with relaxed configuration...`
          );
          const text = await executeSingleModelCall({
            provider,
            apiKey,
            model: candidateModel,
            systemPrompt,
            userPrompt,
            temperature,
            maxOutputTokens,
            requireJson: false, // fallback to standard text prompt
            useAdvancedConfig: false,
          });
          return { text, modelUsed: candidateModel, autoRecovered: true };
        } catch {
          // Continue to next fallback model
        }
      }

      // If it's a model 404/unavailable or rate limit, log and proceed to next model in fallback chain
      if (isModelUnavailableError(msg) || isRateLimitError(msg) || i < candidateModels.length - 1) {
        console.warn(
          `[AutoErrorHandler] Intercepted error on "${candidateModel}": ${msg}. Auto-switching to next candidate in fallback chain.`
        );
        didRecover = true;
        continue;
      }
    }
  }

  throw lastError || new Error(`AI generation failed after checking fallback models for provider ${provider}.`);
}

/**
 * Internal single model executor
 */
async function executeSingleModelCall(params: {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  requireJson: boolean;
  useAdvancedConfig: boolean;
}): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxOutputTokens,
    requireJson,
    useAdvancedConfig,
  } = params;

  if (provider.toLowerCase() === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    const cleanModel = sanitizeModelId(model);

    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: Math.max(maxOutputTokens || 8192, 8192),
    };

    if (useAdvancedConfig && requireJson) {
      generationConfig.responseMimeType = 'application/json';
    }

    if (cleanModel.includes('2.5') || cleanModel.includes('2.0')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const geminiModel = genAI.getGenerativeModel({
      model: cleanModel,
      generationConfig: generationConfig as any,
    });

    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await geminiModel.generateContent(combinedPrompt);
    return result.response.text();
  } else {
    // Non-Gemini provider via provider registry adapter
    return await executeProviderChat(
      provider,
      apiKey,
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
    );
  }
}

/**
 * Autonomous Streaming Wrapper for generate/route.ts
 */
export async function createSelfHealingAiStream(options: {
  provider: string;
  apiKey: string;
  model: string;
  promptText: string;
  systemPrompt: string;
  onStep?: (msg: string) => void;
}): Promise<{
  stream: AsyncIterable<string>;
  modelUsed: string;
  autoRecovered: boolean;
}> {
  const { provider, apiKey, model: initialModel, promptText, systemPrompt, onStep } = options;
  const candidateModels = getModelFallbackChain(provider, initialModel);

  let activeModelUsed = candidateModels[0] || 'gemini-2.5-flash';
  let isAutoRecovered = false;

  async function* resilientStreamGenerator() {
    let lastError: Error | null = null;
    let hasYieldedAny = false;

    for (let i = 0; i < candidateModels.length; i++) {
      const candidateModel = candidateModels[i];
      activeModelUsed = candidateModel;
      isAutoRecovered = i > 0;

      try {
        if (i > 0) {
          onStep?.(`Self-healing active: switched to ${candidateModel}…`);
        }

        if (provider.toLowerCase() === 'gemini') {
          const genAI = new GoogleGenerativeAI(apiKey);
          const cleanModel = sanitizeModelId(candidateModel);
          const generationConfig: Record<string, unknown> = {
            temperature: 0.15,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          };
          if (cleanModel.includes('2.5') || cleanModel.includes('2.0')) {
            generationConfig.thinkingConfig = { thinkingBudget: 0 };
          }

          const geminiModel = genAI.getGenerativeModel({
            model: cleanModel,
            generationConfig: generationConfig as any,
          });

          const streamResult = await geminiModel.generateContentStream(promptText);

          for await (const chunk of streamResult.stream) {
            const t = chunk.text();
            if (t) {
              yield t;
              hasYieldedAny = true;
            }
          }

          // Successfully completed stream without error
          return;
        } else {
          const chatStream = await createProviderChatStream(
            provider,
            apiKey,
            candidateModel,
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: promptText },
            ]
          );

          const reader = chatStream.getReader();
          const decoder = new TextDecoder();
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
                if (!dataStr) continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.text) {
                    yield data.text;
                    hasYieldedAny = true;
                  }
                } catch {
                  // ignore
                }
              }
            }
          }

          // Successfully completed provider stream
          return;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(msg);

        // If chunks were already yielded to the client, cannot restart stream
        if (hasYieldedAny) {
          throw lastError;
        }

        if (isAuthError(msg)) {
          throw lastError;
        }

        console.warn(
          `[AutoErrorHandler:Stream] Model "${candidateModel}" failed: ${msg}. Attempting automatic recovery with next candidate.`
        );
        onStep?.(`Auto-recovering: model "${candidateModel}" unavailable, switching…`);
        continue;
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error(`All streaming fallback attempts exhausted for ${provider}.`);
  }

  return {
    stream: resilientStreamGenerator(),
    modelUsed: activeModelUsed,
    autoRecovered: isAutoRecovered,
  };
}
