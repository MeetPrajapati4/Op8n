import { ModelInfo } from '../registry/providers';

interface CacheEntry {
  models: ModelInfo[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache as required
const cacheMap = new Map<string, CacheEntry>();

export function getCachedModels(provider: string): ModelInfo[] | null {
  const entry = cacheMap.get(provider);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cacheMap.delete(provider);
    return null;
  }

  return entry.models;
}

export function setCachedModels(provider: string, models: ModelInfo[]): void {
  cacheMap.set(provider, {
    models,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateModelCache(provider?: string): void {
  if (provider) {
    cacheMap.delete(provider);
  } else {
    cacheMap.clear();
  }
}
