import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { validateAndRepairWorkflow } from '@/lib/validator';
import { DEFAULT_PREFERENCES, WorkflowPreferences } from '@/lib/settings';

// Basic in-memory rate limiter (30 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

// Zod Input Validation
const generateInputSchema = z.object({
  description: z
    .string()
    .min(3, 'Description must be at least 3 characters long')
    .max(5000, 'Description must not exceed 5,000 characters'),
  preferences: z
    .object({
      targetVersion: z.enum(['v1', 'v0']).optional(),
      injectPinData: z.boolean().optional(),
      errorHandling: z.enum(['none', 'continue', 'retry']).optional(),
      layoutSpacing: z.union([z.literal(180), z.literal(220), z.literal(280)]).optional(),
      addStickyNote: z.boolean().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
});

function cleanJsonString(raw: string): string {
  const stripped = raw
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : stripped;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute before generating again.' },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return NextResponse.json(
      { error: 'Server GEMINI_API_KEY is not configured in .env.local.' },
      { status: 500 }
    );
  }

  // Parse and validate body
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const inputResult = generateInputSchema.safeParse(bodyJson);
  if (!inputResult.success) {
    return NextResponse.json(
      { error: inputResult.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { description, preferences = DEFAULT_PREFERENCES } = inputResult.data;

  // Server-Sent Events Streaming Response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        sendEvent('step', 'Analyzing automation requirements…');

        const genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.5-flash with thinkingBudget: 0 and responseMimeType: application/json
        // for ultra-fast generation (3-5 seconds response time!)
        const geminiModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.15,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
            maxOutputTokens: 2500,
          } as any,
        });

        sendEvent('step', 'Building n8n workflow graph…');

        let promptText = `${SYSTEM_PROMPT}\n\nGenerate an n8n workflow for: ${description.trim()}`;
        if (preferences.injectPinData) {
          promptText += '\nInclude realistic sample test payload data in the trigger node parameters.';
        }

        const streamResult = await geminiModel.generateContentStream(promptText);
        let rawOutput = '';

        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
          rawOutput += text;
          sendEvent('chunk', text);
        }

        sendEvent('step', 'Validating schema & checking credentials…');

        // Parse and validate
        const cleaned = cleanJsonString(rawOutput);
        let parsedWorkflow: unknown;
        try {
          parsedWorkflow = JSON.parse(cleaned);
        } catch {
          throw new Error('Model output could not be parsed as JSON. Please retry.');
        }

        const validation = validateAndRepairWorkflow(parsedWorkflow, preferences as WorkflowPreferences);

        sendEvent('done', {
          workflow: validation.repairedWorkflow,
          validation,
          nodeCount: validation.repairedWorkflow.nodes.length,
        });

        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown generation error';
        sendEvent('error', { error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
