import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserActionModel, SuggestionItemModel } from '@/lib/models/Recommendation';
import { DEFAULT_SUGGESTIONS_CATALOG } from '@/lib/recommendations/catalog';
import { rankSuggestions, ActionRecord } from '@/lib/recommendations/ranking';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'suggestions-api', 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId')?.trim() || 'anonymous';
  const limitParam = parseInt(searchParams.get('limit') || '16', 10);
  const limit = Math.min(Math.max(1, limitParam), 20);

  try {
    const mongoose = await connectToDatabase();

    // 1. If MongoDB is connected, query actual database logs
    if (mongoose) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch user actions within the 30-day time window
      const actions = await UserActionModel.find({
        userId,
        timestamp: { $gte: thirtyDaysAgo },
      })
        .sort({ timestamp: -1 })
        .limit(200)
        .lean();

      // Check if custom items exist in database; otherwise use curated catalog
      const dbCatalog = await SuggestionItemModel.find({}).lean();
      const catalog =
        dbCatalog && dbCatalog.length > 0 ? (dbCatalog as any) : DEFAULT_SUGGESTIONS_CATALOG;

      const ranked = rankSuggestions(actions as ActionRecord[], catalog, limit);
      return NextResponse.json({
        success: true,
        source: 'mongodb',
        userId,
        data: ranked,
      });
    }

    // 2. Fallback when MongoDB is not connected: Return curated catalog
    const fallbackRanked = rankSuggestions([], DEFAULT_SUGGESTIONS_CATALOG, limit);
    return NextResponse.json({
      success: true,
      source: 'catalog_fallback',
      userId,
      data: fallbackRanked,
    });
  } catch (err: unknown) {
    console.error('[Op8n Suggestions API Error]:', err);
    // Graceful error recovery: Return default catalog so frontend never breaks
    const safeDefaults = rankSuggestions([], DEFAULT_SUGGESTIONS_CATALOG, limit);
    return NextResponse.json({
      success: true,
      source: 'safe_recovery',
      userId,
      data: safeDefaults,
    });
  }
}
