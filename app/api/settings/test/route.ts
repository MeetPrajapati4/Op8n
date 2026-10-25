import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';
import { getDecryptedProviderKey } from '@/lib/server/key-store';
import { testProviderConnection } from '@/lib/server/provider-client';

const testSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'settings-test', 10, 60 * 1000);
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

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { provider } = parsed.data;

  const keyData = getDecryptedProviderKey(provider);
  if (!keyData || !keyData.apiKey) {
    return NextResponse.json(
      { error: `Provider ${provider} is not configured with an API key` },
      { status: 400 }
    );
  }

  try {
    const result = await testProviderConnection(provider, keyData.apiKey, keyData.baseUrl);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection test failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
