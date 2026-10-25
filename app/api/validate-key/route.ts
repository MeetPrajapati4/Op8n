import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';
import { fetchLiveModelsFromProvider, testProviderConnection } from '@/lib/server/provider-client';
import { getProviderEntry, isValidProviderId } from '@/lib/registry/providers';
import { filterSuitableWorkflowModels } from '@/lib/registry/model-filter';

const validateKeySchema = z.object({
  apiKey: z.string().min(8, 'API key must be at least 8 characters long'),
  provider: z.string().optional(),
});

function detectProvider(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) return 'gemini';
  if (trimmed.startsWith('sk-ant-')) return 'anthropic';
  if (trimmed.startsWith('sk-or-')) return 'openrouter';
  if (trimmed.startsWith('gsk_')) return 'groq';
  if (trimmed.startsWith('xai-')) return 'xai';
  if (trimmed.startsWith('fw-')) return 'fireworks';
  if (trimmed.startsWith('nvapi-')) return 'nvidia';
  if (trimmed.startsWith('co-')) return 'cohere';
  if (trimmed.startsWith('pplx-')) return 'perplexity';
  if (trimmed.startsWith('sk-')) return 'openai';
  return 'openai';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'validate-key', 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many validation attempts. Please wait a moment.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parseResult = validateKeySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || 'Invalid API key format' },
      { status: 400 }
    );
  }

  const apiKey = parseResult.data.apiKey.trim();
  let provider = parseResult.data.provider?.trim();

  if (!provider || !isValidProviderId(provider)) {
    provider = detectProvider(apiKey);
  }

  const reg = getProviderEntry(provider);
  if (!reg) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  try {
    // If provider is perplexity or has no list endpoint, test connection probe
    if (provider === 'perplexity' || !reg.listModelsPath) {
      const testResult = await testProviderConnection(provider, apiKey);
      if (!testResult.ok) {
        return NextResponse.json(
          { error: testResult.message || 'Authentication failed' },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        provider,
        providerName: reg.name,
        models: reg.staticModels || [{ id: reg.defaultModel || 'sonar', name: 'Sonar' }],
      });
    }

    // Call provider's live model list endpoint
    const liveModels = await fetchLiveModelsFromProvider(provider, apiKey);
    const suitableModels = filterSuitableWorkflowModels(liveModels);

    const finalModels = suitableModels.length > 0 ? suitableModels : (reg.staticModels || liveModels);

    if (!finalModels || finalModels.length === 0) {
      return NextResponse.json(
        { error: `No models returned by ${reg.name} for this key.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider,
      providerName: reg.name,
      models: finalModels,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    const isAuthError =
      message.toLowerCase().includes('auth') ||
      message.toLowerCase().includes('invalid') ||
      message.toLowerCase().includes('key') ||
      message.toLowerCase().includes('401') ||
      message.toLowerCase().includes('403');

    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 400 }
    );
  }
}
