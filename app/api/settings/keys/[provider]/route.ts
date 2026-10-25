import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSession } from '@/lib/server/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';
import { deleteProviderKey, setDefaultModelForProvider } from '@/lib/server/key-store';
import { invalidateModelCache } from '@/lib/server/model-cache';

const patchSchema = z.object({
  defaultModel: z.string().min(1, 'Default model cannot be empty'),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'settings-keys', 15, 60 * 1000);
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

  const { provider } = await params;
  if (!provider) {
    return NextResponse.json({ error: 'Provider parameter missing' }, { status: 400 });
  }

  const removed = deleteProviderKey(provider);
  invalidateModelCache(provider);

  return NextResponse.json({ ok: true, removed });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
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

  const { provider } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const updated = setDefaultModelForProvider(provider, parsed.data.defaultModel);
  return NextResponse.json({ ok: true, updated });
}
