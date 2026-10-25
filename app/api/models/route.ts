import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';
import { getDecryptedProviderKey } from '@/lib/server/key-store';
import { getCachedModels, setCachedModels } from '@/lib/server/model-cache';
import { fetchLiveModelsFromProvider } from '@/lib/server/provider-client';
import { getProviderEntry, isValidProviderId } from '@/lib/registry/providers';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'models-list', 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  // Require either user API key in x-user-api-key header or valid session
  const userApiKey = req.headers.get('x-user-api-key')?.trim();
  const hasSession = verifyAdminSession(req);
  if (!userApiKey && !hasSession) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid API key header or session required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');
  const refresh = searchParams.get('refresh') === 'true';

  if (!provider) {
    return NextResponse.json(
      { error: 'Query parameter "provider" is required' },
      { status: 400 }
    );
  }

  if (!isValidProviderId(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  const reg = getProviderEntry(provider)!;

  // Retrieve key from user header or server store / env
  const stored = getDecryptedProviderKey(provider);

  // Fallback for Gemini if stored key not yet saved but GEMINI_API_KEY is present in env
  const effectiveKey =
    userApiKey ||
    stored?.apiKey ||
    (provider === 'gemini' ? (process.env.GEMINI_API_KEY || process.env.AI_API_KEY) : '');
  const effectiveBaseUrl = stored?.baseUrl || reg.baseUrl;

  if (!effectiveKey && provider !== 'custom') {
    return NextResponse.json(
      {
        error: `Provider ${reg.name} is not configured with an API key`,
        models: reg.staticModels || [],
        configured: false,
      },
      { status: 401 }
    );
  }


  // Check in-memory cache (10 min TTL)
  if (!refresh) {
    const cached = getCachedModels(provider);
    if (cached && cached.length > 0) {
      return NextResponse.json({
        provider,
        models: cached,
        cached: true,
        defaultModel: stored?.defaultModel || reg.defaultModel,
      });
    }
  }

  try {
    const liveModels = await fetchLiveModelsFromProvider(
      provider,
      effectiveKey || '',
      effectiveBaseUrl
    );

    // Cache the normalized model list
    setCachedModels(provider, liveModels);

    return NextResponse.json({
      provider,
      models: liveModels,
      cached: false,
      defaultModel: stored?.defaultModel || reg.defaultModel,
    });
  } catch (err: unknown) {
    // If live fetch fails, fallback to static models if available
    if (reg.staticModels && reg.staticModels.length > 0) {
      return NextResponse.json({
        provider,
        models: reg.staticModels,
        cached: false,
        fallback: true,
        warning: err instanceof Error ? err.message : 'Live fetch failed, using fallback models',
        defaultModel: stored?.defaultModel || reg.defaultModel,
      });
    }

    const msg = err instanceof Error ? err.message : 'Failed to fetch models';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
