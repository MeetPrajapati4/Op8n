import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { validateAndRepairWorkflow } from '@/lib/validator';
import { AIProvider } from '@/lib/providers';

// Basic in-memory rate limiter (20 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

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

  // Parse headers
  const provider = (req.headers.get('x-provider') || 'gemini') as AIProvider;
  const modelName = req.headers.get('x-model') || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
  const userApiKey = req.headers.get('x-api-key') || '';
  const userBaseUrl = req.headers.get('x-base-url') || undefined;

  // Resolve API key
  let apiKey = userApiKey.trim();
  if (!apiKey && provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || '';
  }

  if (provider !== 'ollama' && (!apiKey || apiKey === 'your_key_here')) {
    return NextResponse.json(
      {
        error:
          provider === 'gemini'
            ? 'Please add your Gemini API key in Settings or configure GEMINI_API_KEY in .env.local'
            : `Please add your ${provider} API key in Settings`,
      },
      { status: 400 }
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

  const { description } = inputResult.data;

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

        let rawOutput = '';
        let retryCount = 0;
        let lastErrors: string[] = [];

        while (retryCount <= 2) {
          if (retryCount > 0) {
            sendEvent('step', `Auto-repairing workflow schema (attempt ${retryCount}/2)…`);
          } else {
            sendEvent('step', 'Choosing n8n nodes & building connection graph…');
          }

          let promptText = `${SYSTEM_PROMPT}\n\nGenerate an n8n workflow for: ${description.trim()}`;
          if (retryCount > 0 && lastErrors.length > 0) {
            promptText += `\n\nCRITICAL FIX REQUIRED: Your previous output had these validation errors:\n${lastErrors.map((e) => `- ${e}`).join('\n')}\nFix ALL the above errors and output ONLY valid JSON.`;
          }

          rawOutput = '';

          // Stream from provider
          if (provider === 'gemini') {
            const genAI = new GoogleGenerativeAI(apiKey);
            const geminiModel = genAI.getGenerativeModel({
              model: modelName.includes('gemini') ? modelName : 'gemini-2.5-flash',
            });

            const streamResult = await geminiModel.generateContentStream(promptText);
            for await (const chunk of streamResult.stream) {
              const text = chunk.text();
              rawOutput += text;
              sendEvent('chunk', text);
            }
          } else if (provider === 'openai' || provider === 'openrouter') {
            const endpoint =
              provider === 'openrouter'
                ? 'https://openrouter.ai/api/v1/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            };
            if (provider === 'openrouter') {
              headers['HTTP-Referer'] = 'https://op8n.app';
              headers['X-Title'] = 'Op8n';
            }

            const res = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: modelName,
                stream: true,
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: promptText },
                ],
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`${provider} error (${res.status}): ${errText}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkStr = decoder.decode(value);
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      const delta = parsed.choices?.[0]?.delta?.content || '';
                      if (delta) {
                        rawOutput += delta;
                        sendEvent('chunk', delta);
                      }
                    } catch {
                      // ignore parse errors of individual SSE chunks
                    }
                  }
                }
              }
            }
          } else if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: modelName,
                max_tokens: 4000,
                stream: true,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: promptText }],
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Anthropic error (${res.status}): ${errText}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkStr = decoder.decode(value);
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      if (parsed.type === 'content_block_delta') {
                        const delta = parsed.delta?.text || '';
                        rawOutput += delta;
                        sendEvent('chunk', delta);
                      }
                    } catch {
                      // ignore parse errors
                    }
                  }
                }
              }
            }
          } else if (provider === 'ollama') {
            const baseUrl = userBaseUrl || 'http://localhost:11434';
            const res = await fetch(`${baseUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: modelName,
                stream: true,
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: promptText },
                ],
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Ollama error (${res.status}): ${errText}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkStr = decoder.decode(value);
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                  if (line.trim()) {
                    try {
                      const parsed = JSON.parse(line);
                      const delta = parsed.message?.content || '';
                      if (delta) {
                        rawOutput += delta;
                        sendEvent('chunk', delta);
                      }
                    } catch {
                      // ignore parse error
                    }
                  }
                }
              }
            }
          }

          // Validate and parse raw output
          const cleaned = cleanJsonString(rawOutput);
          let parsedWorkflow: unknown;
          try {
            parsedWorkflow = JSON.parse(cleaned);
          } catch {
            lastErrors = ['Output was not parseable as JSON. Please ensure valid JSON format.'];
            retryCount++;
            continue;
          }

          const validation = validateAndRepairWorkflow(parsedWorkflow);

          if (!validation.isValid && retryCount < 2) {
            lastErrors = validation.errors.map((e) => e.message);
            retryCount++;
            continue;
          }

          // Completed or max retries reached
          sendEvent('step', 'Finalizing and verifying layout…');
          sendEvent('done', {
            workflow: validation.repairedWorkflow,
            validation,
            nodeCount: validation.repairedWorkflow.nodes.length,
          });
          controller.close();
          return;
        }

        // If loop exited after 2 retries without a valid output
        sendEvent('error', {
          error: `Workflow generation failed after 2 repair attempts: ${lastErrors.join('; ')}`,
        });
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown generation error occurred';
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
