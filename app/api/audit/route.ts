import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAiConfig } from '@/lib/server/ai-config';
import { executeSelfHealingAiCall, isAuthError } from '@/lib/server/auto-error-handler';

// Maximum size limits for payload to prevent abuse
const auditInputSchema = z
  .object({
    workflowJson: z.union([
      z.string().min(5, 'Workflow JSON is required').max(50000, 'Workflow JSON must not exceed 50,000 characters'),
      z.record(z.string(), z.unknown()),
    ]).optional(),
    workflow: z.union([
      z.string().min(5, 'Workflow is required').max(50000, 'Workflow must not exceed 50,000 characters'),
      z.record(z.string(), z.unknown()),
    ]).optional(),
  })
  .refine((data) => data.workflowJson || data.workflow, {
    message: 'Either workflowJson or workflow is required',
  });

export async function POST(req: NextRequest) {
  // 1. Check user key headers or server key fallback
  const userApiKey = req.headers.get('x-user-api-key')?.trim();
  const userProvider = req.headers.get('x-user-provider')?.trim();
  const userModel = req.headers.get('x-user-model')?.trim();

  const serverConfig = getServerAiConfig();
  const effectiveApiKey = userApiKey || serverConfig.apiKey;
  const effectiveProvider = userApiKey ? (userProvider || 'gemini') : serverConfig.provider;
  const effectiveModel = userModel || serverConfig.model || (effectiveProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');

  if (!effectiveApiKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Please connect your API key in Preferences.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parseResult = auditInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const target = parseResult.data.workflowJson || parseResult.data.workflow;
  const workflowString =
    typeof target === 'string'
      ? target
      : JSON.stringify(target, null, 2);

  if (workflowString.length > 50000) {
    return NextResponse.json(
      { error: 'Workflow JSON payload exceeds the 50,000 character limit.' },
      { status: 400 }
    );
  }

  const systemInstruction = 'You are an expert n8n workflow architect and security auditor.';
  const userPrompt = `Analyze this n8n workflow JSON and return a JSON object with this exact schema:
{
  "title": "Short descriptive title of what this workflow does",
  "summary": "2-3 sentences explaining the business logic and flow",
  "trigger": "Name of the triggering event/node and how it initiates",
  "steps": [
    { "node": "Node Name", "role": "What this step does" }
  ],
  "securityFindings": [
    { "level": "info|warning|critical", "message": "Security consideration or vulnerability" }
  ],
  "reliabilityFindings": [
    { "level": "info|warning|critical", "message": "Error handling, rate limiting, or failover finding" }
  ],
  "recommendations": [
    "Specific actionable tip to optimize or harden this workflow"
  ]
}

Workflow JSON:
${workflowString}

Return ONLY valid JSON.`;

  try {
    const { text: rawText, modelUsed, autoRecovered } = await executeSelfHealingAiCall({
      provider: effectiveProvider,
      apiKey: effectiveApiKey,
      model: effectiveModel,
      systemPrompt: systemInstruction,
      userPrompt,
      temperature: 0.2,
      maxOutputTokens: 2500,
      requireJson: true,
    });

    let cleanJson = rawText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Fallback: extract JSON substring if wrapped in extra text
    if (!cleanJson.startsWith('{')) {
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) cleanJson = match[0];
    }

    const analysis = JSON.parse(cleanJson);
    return NextResponse.json({ analysis, modelUsed, autoRecovered });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    const isAuth = isAuthError(msg);

    return NextResponse.json(
      { error: isAuth ? 'Invalid or expired API key. Provider rejected authentication.' : msg },
      { status: isAuth ? 401 : 500 }
    );
  }
}


