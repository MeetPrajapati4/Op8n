/**
 * Utility to filter AI models specifically suitable for Op8n Studio:
 * Autonomous n8n Workflow Generation, Architecture, JSON Auditing, and Refinement.
 *
 * Discards non-generative, audio, speech, image, diffusion, embedding, moderation,
 * reranker, instruct-completion-only, raw thinking preview, roleplay, and toy models
 * that cannot reliably generate schema-compliant n8n workflows.
 */

// Unwanted model keywords and patterns (case-insensitive)
const UNSUITABLE_PATTERNS = [
  // Audio, Speech, Music, Whisper & TTS
  /\bwhisper\b/i,
  /\btts\b/i,
  /\bspeech\b/i,
  /\baudio\b/i,
  /\bvoice\b/i,
  /\blyria\b/i,
  /\bmusic\b/i,
  /\bclip\b/i,
  /preview-tts/i,
  /realtime/i,

  // Image, Vision-only & Diffusion generation
  /\bimagen\b/i,
  /\bdall-?e\b/i,
  /\bflux\b/i,
  /diffusion/i,
  /\bsdxl\b/i,
  /midjourney/i,
  /stable-diffusion/i,
  /\bbanana\b/i,
  /-image\b/i,
  /image-preview/i,
  /flash-image/i,
  /pro-image/i,
  /vision-preview/i,

  // Embeddings & Vector models
  /embed/i,
  /embedding/i,
  /\bgecko\b/i,
  /\bbge-/i,
  /\bnomic-/i,
  /\be5-/i,

  // Moderation & Safety Guards
  /moderation/i,
  /\bguard\b/i,
  /safety/i,
  /shield/i,

  // Rerankers
  /rerank/i,
  /colbert/i,

  // Incompatible chat completions endpoints (e.g. OpenAI completion-only models)
  /gpt-3\.5-turbo-instruct/i,
  /\bbabbage\b/i,
  /\bdavinci\b/i,
  /\bcurie\b/i,
  /\bada\b/i,

  // Obsolete dated OpenAI snapshots cluttering the selector
  /(gpt-4|gpt-3\.5-turbo)-(0314|0613|1106|0125)/i,
  /gpt-4-32k/i,

  // Specialized Non-Workflow or Experimental Thinking Models
  /\bresearch\b/i,
  /deep-research/i,
  /\bgemma\b/i,
  /\baqa\b/i, // Attributed Question Answering
  /search-preview/i,
  /thinking-exp/i, // Raw thought streaming breaks standard JSON response parsing
  /learnlm/i,
  /command-light/i, // 4k context too small for workflow schemas

  // Toy, low-parameter, and roleplay models that hallucinate invalid JSON
  /\b(1b|2b|3b)\b/i,
  /:free$/i,
  /\b(mythomax|noromaid|pygmalion|fimbulvetr|cinematika)\b/i,

  // Discontinued, deprecated, lite, or non-functional preview models
  /\bgemini-1\.5-pro\b/i,
  /\blite\b/i,
  /-lite\b/i,
  /flash-lite/i,
  /deprecated/i,
  /experimental/i,
];

// Preferred top-tier instruction & reasoning prefixes for priority sorting
const PRIORITY_PREFIXES = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'claude-3-7-sonnet',
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'claude-3-opus',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o1',
  'gpt-4-turbo',
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-r1',
  'llama-3.3-70b',
  'llama-3.1-70b',
  'llama-3.1-8b',
  'qwen2.5-coder',
  'qwen2.5',
  'codestral',
  'mistral-large',
  'command-r-plus',
  'command-r',
  'grok-2',
  'sonar-pro',
  'sonar',
];

/**
 * Returns a human-friendly label for supported models.
 */
export function getFriendlyModelName(modelId: string, originalName?: string): string {
  const idLower = modelId.toLowerCase();

  if (idLower === 'gemini-2.5-flash') return 'Gemini 2.5 Flash (Fastest)';
  if (idLower === 'gemini-2.5-pro') return 'Gemini 2.5 Pro (Deep Reasoning)';
  if (idLower === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
  if (idLower === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';

  if (idLower.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet (Hybrid Reasoning)';
  if (idLower.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet (Recommended)';
  if (idLower.includes('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
  if (idLower.includes('claude-3-opus')) return 'Claude 3 Opus';

  if (idLower === 'gpt-4o') return 'GPT-4o (Omni)';
  if (idLower === 'gpt-4o-mini') return 'GPT-4o Mini';
  if (idLower === 'o3-mini') return 'o3-mini (Reasoning)';
  if (idLower === 'o1') return 'o1 (Deep Reasoning)';
  if (idLower === 'gpt-4-turbo') return 'GPT-4 Turbo';

  if (idLower === 'deepseek-chat') return 'DeepSeek V3 (Chat)';
  if (idLower === 'deepseek-reasoner') return 'DeepSeek R1 (Reasoner)';

  if (idLower.includes('llama-3.3-70b')) return 'Llama 3.3 70B';
  if (idLower.includes('llama-3.1-70b')) return 'Llama 3.1 70B';
  if (idLower.includes('llama-3.1-8b')) return 'Llama 3.1 8B Instant';

  if (idLower.includes('codestral')) return 'Codestral (Latest)';
  if (idLower.includes('mistral-large')) return 'Mistral Large';

  if (idLower.includes('grok-2')) return 'Grok 2';
  if (idLower.includes('sonar-pro')) return 'Sonar Pro';
  if (idLower === 'sonar') return 'Sonar';

  if (originalName && originalName !== modelId) {
    return originalName;
  }

  // Clean trailing dates or technical prefixes
  return modelId
    .split('/')
    .pop()!
    .replace(/-20\d{6}$/, '')
    .replace(/-latest$/, '');
}

/**
 * Checks if a given model is suitable for Op8n Studio's n8n workflow generation and JSON audit.
 */
export function isSuitableWorkflowModel(
  modelId: string,
  modelName?: string,
  contextWindow?: number
): boolean {
  const target = `${modelId} ${modelName || ''}`.trim();
  if (!target) return false;

  // 1. Exclude unsuitable categories (audio, image, embeddings, guards, research, toy, etc.)
  for (const pattern of UNSUITABLE_PATTERNS) {
    if (pattern.test(target)) {
      return false;
    }
  }

  // 2. Filter out models with known tiny context windows (< 8,192 tokens)
  if (typeof contextWindow === 'number' && contextWindow > 0 && contextWindow < 8192) {
    return false;
  }

  const idLower = modelId.toLowerCase();

  // 3. For Gemini API: only keep verified production flash/pro generative LLMs
  if (idLower.includes('gemini')) {
    const isGenerative =
      idLower.includes('flash') ||
      idLower.includes('pro') ||
      idLower.includes('ultra');
    if (!isGenerative) return false;
    // Exclude image generation and vision-only variants
    if (idLower.includes('image') || idLower.includes('vision')) return false;
    // Exclude raw experimental thinking models
    if (idLower.includes('thinking-exp')) return false;
    // Exclude discontinued / lite / experimental preview variants (e.g. gemini-2.5-flash-lite)
    if (idLower.includes('lite') || idLower.includes('preview') || idLower.includes('exp')) return false;
  }

  // 4. For OpenAI: exclude legacy completion-only or snapshot duplicates
  if (idLower.startsWith('gpt-') || idLower.startsWith('o1') || idLower.startsWith('o3')) {
    if (idLower.includes('instruct') || idLower.includes('realtime') || idLower.includes('audio')) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of models to only return models suitable for Op8n Studio,
 * sorted with the most capable, relevant models first.
 */
export function filterSuitableWorkflowModels<T extends { id: string; name?: string; contextWindow?: number }>(
  models: T[]
): T[] {
  if (!Array.isArray(models)) return [];

  const filtered = models.filter((m) =>
    isSuitableWorkflowModel(m.id, m.name, m.contextWindow)
  );

  // If filtering excluded everything, fall back to original
  if (filtered.length === 0 && models.length > 0) {
    return models;
  }

  // Sort with highest-tier, modern models at the top
  return filtered.sort((a, b) => {
    const aId = a.id.toLowerCase();
    const bId = b.id.toLowerCase();

    const aPriorityIndex = PRIORITY_PREFIXES.findIndex((p) => aId.includes(p));
    const bPriorityIndex = PRIORITY_PREFIXES.findIndex((p) => bId.includes(p));

    if (aPriorityIndex !== -1 && bPriorityIndex !== -1) {
      return aPriorityIndex - bPriorityIndex;
    }
    if (aPriorityIndex !== -1) return -1;
    if (bPriorityIndex !== -1) return 1;

    return (a.name || a.id).localeCompare(b.name || b.id);
  });
}
