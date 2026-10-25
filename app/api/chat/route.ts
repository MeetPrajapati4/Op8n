import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDecryptedProviderKey } from '@/lib/server/key-store';
import { createProviderChatStream, ChatMessage } from '@/lib/server/provider-client';
import { getProviderEntry, isValidProviderId } from '@/lib/registry/providers';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';

const chatRequestSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1, 'Message content cannot be empty'),
      })
    )
    .min(1, 'At least one message is required'),
  baseUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'chat-proxy', 30, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute before making another request.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { provider, model, messages, baseUrl } = parsed.data;

  if (!isValidProviderId(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  const reg = getProviderEntry(provider)!;

  // Retrieve decrypted key from server store
  const stored = getDecryptedProviderKey(provider);
  const effectiveKey =
    stored?.apiKey ||
    (provider === 'gemini' ? process.env.GEMINI_API_KEY : '');
  const effectiveBaseUrl = baseUrl || stored?.baseUrl || reg.baseUrl;

  if (!effectiveKey && provider !== 'custom') {
    return NextResponse.json(
      {
        error: `Provider ${reg.name} is not configured on the server. Please add an API key in Provider Settings.`,
      },
      { status: 400 }
    );
  }

  try {
    const stream = await createProviderChatStream(
      provider,
      effectiveKey || '',
      model,
      messages as ChatMessage[],
      effectiveBaseUrl
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Failed to communicate with provider';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
