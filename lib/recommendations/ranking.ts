import { DEFAULT_SUGGESTIONS_CATALOG, SuggestionPreset } from './catalog';

export interface ActionRecord {
  itemId: string;
  actionType: 'view' | 'click' | 'generate' | 'refine' | 'deploy';
  category: string;
  tags?: string[];
  timestamp: Date | string | number;
}

export interface RankedSuggestion extends SuggestionPreset {
  score: number;
  reason: string;
}

const ACTION_WEIGHTS: Record<string, number> = {
  deploy: 5.0,
  generate: 3.5,
  refine: 2.0,
  click: 1.5,
  view: 0.5,
};

// 7-day half-life decay constant: lambda = ln(2) / 7 days
const HALF_LIFE_DAYS = 7;
const DECAY_LAMBDA = Math.LN2 / HALF_LIFE_DAYS;

/**
 * Pure ranking function that scores and ranks catalog items for a given user's action history.
 * Automatically handles cold start for new users.
 */
export function rankSuggestions(
  recentActions: ActionRecord[],
  catalog: SuggestionPreset[] = DEFAULT_SUGGESTIONS_CATALOG,
  limit = 6
): RankedSuggestion[] {
  // 1. Cold Start Check: New or low-activity users receive curated default suggestions
  if (!recentActions || recentActions.length < 2) {
    const defaultItems = catalog.filter((item) => item.isDefault);
    return defaultItems
      .sort((a, b) => b.globalPopularityScore - a.globalPopularityScore)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        score: 1.0,
        reason: 'Trending starter',
      }));
  }

  const now = Date.now();
  const itemDirectScores = new Map<string, number>();
  const categoryAffinities = new Map<string, number>();
  const tagAffinities = new Map<string, number>();

  // 2. Accumulate frequency & exponential time-decay scores
  for (const action of recentActions) {
    const actionTime = new Date(action.timestamp).getTime();
    const ageDays = Math.max(0, (now - actionTime) / (1000 * 60 * 60 * 24));
    const recencyMultiplier = Math.exp(-DECAY_LAMBDA * ageDays);
    const weight = ACTION_WEIGHTS[action.actionType] || 1.0;
    const impact = weight * recencyMultiplier;

    // Accumulate item score
    itemDirectScores.set(action.itemId, (itemDirectScores.get(action.itemId) || 0) + impact);

    // Accumulate category affinity
    if (action.category) {
      categoryAffinities.set(
        action.category,
        (categoryAffinities.get(action.category) || 0) + impact
      );
    }

    // Accumulate tag affinity
    if (action.tags && Array.isArray(action.tags)) {
      for (const tag of action.tags) {
        tagAffinities.set(tag, (tagAffinities.get(tag) || 0) + impact * 0.5);
      }
    }
  }

  // 3. Score every item in the catalog
  const ranked = catalog.map((item) => {
    const directScore = itemDirectScores.get(item.itemId) || 0;
    const catAffinity = categoryAffinities.get(item.category) || 0;

    let tagMatchScore = 0;
    for (const t of item.tags) {
      tagMatchScore += tagAffinities.get(t) || 0;
    }

    const popularityBonus = (item.globalPopularityScore || 50) * 0.02;

    // Weighted composite score: Direct Interactions (60%) + Category Affinity (25%) + Tag Affinity (10%) + Popularity (5%)
    const finalScore =
      directScore * 0.6 + catAffinity * 0.25 + tagMatchScore * 0.1 + popularityBonus;

    // Generate human-friendly rationale for UI
    let reason = 'Recommended for you';
    if (directScore >= 2.5) {
      reason = 'Frequently used';
    } else if (catAffinity >= 2.0) {
      reason = `Based on your ${item.category} workflows`;
    } else if (tagMatchScore >= 1.5) {
      reason = 'Matches your automation stack';
    }

    return {
      ...item,
      score: Number(finalScore.toFixed(3)),
      reason,
    };
  });

  // 4. Return top-N items sorted descending by score
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
