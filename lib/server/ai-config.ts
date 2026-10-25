/**
 * Server-Only AI Engine Configuration
 * 
 * Reads server environment variables strictly on the server side.
 * Never exposed to the browser, client bundle, or network responses.
 */

export interface ServerAiConfig {
  apiKey: string;
  provider: string;
  model: string;
}

export function getServerAiConfig(): ServerAiConfig {
  // 1. Primary server environment variable: AI_API_KEY
  const primaryKey = process.env.AI_API_KEY?.trim();
  if (primaryKey && primaryKey !== 'your_key_here') {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const model = process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');
    return {
      apiKey: primaryKey,
      provider,
      model,
    };
  }

  // 2. Existing server variable: GEMINI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && geminiKey !== 'your_key_here') {
    return {
      apiKey: geminiKey,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    };
  }

  // 3. Fallback to other standard server env variables if configured on Vercel
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && openaiKey !== 'your_key_here') {
    return {
      apiKey: openaiKey,
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey && anthropicKey !== 'your_key_here') {
    return {
      apiKey: anthropicKey,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    };
  }

  return {
    apiKey: '',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  };
}

export function isCloudEngineActive(): boolean {
  return Boolean(getServerAiConfig().apiKey);
}
