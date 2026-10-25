export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getServerAiConfig } = await import('./lib/server/ai-config');
    const config = getServerAiConfig();
    if (config.apiKey) {
      console.log(`[Op8n] Cloud Engine Active (Provider: ${config.provider})`);
    } else {
      console.warn('[Op8n] Notice: Server AI_API_KEY is not configured yet. Configure AI_API_KEY in Vercel Environment Variables.');
    }
  }
}
