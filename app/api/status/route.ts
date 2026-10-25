import { NextResponse } from 'next/server';
import { getServerAiConfig } from '@/lib/server/ai-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getServerAiConfig();
  const active = Boolean(config.apiKey);

  return NextResponse.json({
    status: active ? 'ok' : 'unconfigured',
    cloudEngineActive: active,
    engine: active ? 'Cloud Engine Active' : 'Cloud Engine Inactive',
    provider: active ? config.provider : null,
    model: active ? config.model : null,
    message: active
      ? 'Vercel serverless AI engine is ready'
      : 'Set AI_API_KEY in Vercel environment variables to enable workflow generation',
  });
}
