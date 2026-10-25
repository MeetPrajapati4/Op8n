import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserActionModel, SuggestionItemModel } from '@/lib/models/Recommendation';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';

const trackSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  itemId: z.string().min(1, 'itemId is required'),
  actionType: z.enum(['view', 'click', 'generate', 'refine', 'deploy']),
  category: z.string().default('General'),
  tags: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'track-api', 120, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, itemId, actionType, category, tags } = parsed.data;

  try {
    const mongoose = await connectToDatabase();

    if (mongoose) {
      // 1. Insert action record into MongoDB
      await UserActionModel.create({
        userId,
        itemId,
        actionType,
        category,
        tags,
        timestamp: new Date(),
      });

      // 2. Increment global item popularity if applicable
      const scoreDelta = actionType === 'deploy' ? 5 : actionType === 'generate' ? 3 : 1;
      await SuggestionItemModel.updateOne(
        { itemId },
        {
          $inc: { globalPopularityScore: scoreDelta },
          $setOnInsert: {
            title: itemId,
            description: category,
            category,
            tags,
            isDefault: false,
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        stored: 'mongodb',
        message: 'Action tracked successfully',
      });
    }

    // Acknowledge gracefully when MongoDB is running in offline/stateless mode
    return NextResponse.json({
      success: true,
      stored: 'client_local',
      message: 'Action logged in client session',
    });
  } catch (err: unknown) {
    console.error('[Track API Error]:', err);
    return NextResponse.json(
      { error: 'Failed to record interaction' },
      { status: 500 }
    );
  }
}
