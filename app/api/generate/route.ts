import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { validateAndRepairWorkflow } from '@/lib/validator';
import { DEFAULT_PREFERENCES, WorkflowPreferences } from '@/lib/settings';
import { getServerAiConfig } from '@/lib/server/ai-config';
import { createSelfHealingAiStream, isAuthError } from '@/lib/server/auto-error-handler';
import { robustJsonParse, synthesizeFallbackWorkflow } from '@/lib/json-repair';

// In-memory rate limiter per IP (30 requests per minute)
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

// Zod Input Validation: Strictly limits description to 5,000 characters
const generateInputSchema = z.object({
  description: z
    .string()
    .min(3, 'Description must be at least 3 characters long')
    .max(5000, 'Description must not exceed 5,000 characters'),
  model: z.string().optional(),
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute before generating again.' },
      { status: 429 }
    );
  }

  // 1. Check if user provided an API key in request headers
  const userApiKey = req.headers.get('x-user-api-key')?.trim();
  const userProvider = req.headers.get('x-user-provider')?.trim();

  // 2. Fallback to server-only environment variable if no user key provided
  const serverConfig = getServerAiConfig();
  const effectiveApiKey = userApiKey || serverConfig.apiKey;
  const effectiveProvider = userApiKey
    ? (userProvider || 'openai')
    : serverConfig.provider;

  if (!effectiveApiKey) {
    return NextResponse.json(
      {
        error:
          'No AI API key configured. Please connect your API key in Preferences.',
      },
      { status: 401 }
    );
  }

  // Parse and validate request body
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

  const { description, model, preferences = DEFAULT_PREFERENCES } = inputResult.data;
  const sanitizedModel = model?.toLowerCase() === 'gemini-1.5-pro' ? 'gemini-2.5-flash' : model;
  const effectiveModel = sanitizedModel || (effectiveProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');

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

        let promptText = `${SYSTEM_PROMPT}\n\nGenerate an n8n workflow for: ${description.trim()}`;
        if (preferences.injectPinData) {
          promptText += '\nInclude realistic sample test payload data in the trigger node parameters.';
        }

        let rawOutput = '';

        sendEvent('step', 'Querying AI model…');

        const { stream: aiStream } = await createSelfHealingAiStream({
          provider: effectiveProvider,
          apiKey: effectiveApiKey,
          model: effectiveModel,
          promptText,
          systemPrompt: SYSTEM_PROMPT,
          onStep: (stepMsg) => sendEvent('step', stepMsg),
        });

        sendEvent('step', 'Building n8n workflow graph…');

        for await (const chunk of aiStream) {
          rawOutput += chunk;
          sendEvent('chunk', chunk);
        }

        sendEvent('step', 'Validating schema & checking credentials…');

        // Parse and validate workflow JSON with multi-stage resilient repair
        let parsedWorkflow: unknown;
        try {
          parsedWorkflow = robustJsonParse(rawOutput);
        } catch {
          try {
            parsedWorkflow = synthesizeFallbackWorkflow(rawOutput, 'Generated Automation');
          } catch {
            throw new Error('Model output could not be parsed as valid JSON. Please retry.');
          }
        }

        const validation = validateAndRepairWorkflow(
          parsedWorkflow,
          preferences as WorkflowPreferences
        );

        sendEvent('done', {
          workflow: validation.repairedWorkflow,
          validation,
          nodeCount: validation.repairedWorkflow.nodes.length,
        });

        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown generation error';
        const isAuthErr = isAuthError(message);

        sendEvent('error', {
          error: isAuthErr
            ? 'Invalid or expired API key. Provider rejected authentication.'
            : message,
          status: isAuthErr ? 401 : 500,
        });
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
