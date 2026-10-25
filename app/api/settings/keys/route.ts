import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';
import { getAllProvidersMetadata, saveProviderKey } from '@/lib/server/key-store';
import { testProviderConnection } from '@/lib/server/provider-client';
import { invalidateModelCache } from '@/lib/server/model-cache';
import { isValidProviderId } from '@/lib/registry/providers';

const saveKeySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  apiKey: z.string().min(1, 'API key cannot be empty'),
  baseUrl: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'settings-keys', 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  // Gate access behind admin authentication
  if (!verifyAdminSession(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin authentication required' },
      { status: 401 }
    );
  }

  // Returns only metadata (configured, last4, updatedAt). NEVER the key!
  const keys = getAllProvidersMetadata();
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'settings-keys', 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }

  // Gate access behind admin authentication
  if (!verifyAdminSession(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin authentication required' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = saveKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { provider, apiKey, baseUrl } = parsed.data;

  if (!isValidProviderId(provider)) {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  // Validate the key against the provider API before saving
  let modelCount = 0;
  try {
    const testResult = await testProviderConnection(provider, apiKey.trim(), baseUrl?.trim());
    modelCount = testResult.modelCount;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Provider validation failed';
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }

  // Encrypt with AES-256-GCM and store securely
  try {
    saveProviderKey(provider, apiKey.trim(), baseUrl?.trim());
    invalidateModelCache(provider);

    // Return { ok, modelCount } ONLY - never the key
    return NextResponse.json({
      ok: true,
      modelCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save provider key securely';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
