import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { validateAndRepairWorkflow } from '@/lib/validator';
import { DEFAULT_PREFERENCES, WorkflowPreferences } from '@/lib/settings';
import { getServerAiConfig } from '@/lib/server/ai-config';
import { executeSelfHealingAiCall, isAuthError } from '@/lib/server/auto-error-handler';

const refineInputSchema = z.object({
  existingWorkflow: z.record(z.string(), z.unknown()),
  instruction: z.string().min(3, 'Instruction must be at least 3 characters').max(5000, 'Instruction must not exceed 5,000 characters'),
  preferences: z.record(z.string(), z.unknown()).optional(),
  model: z.string().optional(),
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
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }

  const parseResult = refineInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { existingWorkflow, instruction, preferences = DEFAULT_PREFERENCES, model: reqModel } = parseResult.data;
  const targetModel = reqModel || effectiveModel;

  const prompt = `${SYSTEM_PROMPT}

You are refining an EXISTING n8n workflow.
Existing Workflow JSON:
${JSON.stringify(existingWorkflow, null, 2)}

User Refinement Request:
"${instruction.trim()}"

Modify the workflow according to the user request. Keep existing node names and structure where possible, add or modify nodes as requested, update connection mappings properly.
Output ONLY the updated valid n8n workflow JSON.`;

  try {
    const { text: rawText, modelUsed, autoRecovered } = await executeSelfHealingAiCall({
      provider: effectiveProvider,
      apiKey: effectiveApiKey,
      model: targetModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `You are refining an EXISTING n8n workflow.\nExisting Workflow JSON:\n${JSON.stringify(existingWorkflow, null, 2)}\n\nUser Refinement Request:\n"${instruction.trim()}"\n\nModify the workflow according to the user request. Keep existing node names and structure where possible, add or modify nodes as requested, update connection mappings properly.\nOutput ONLY the updated valid n8n workflow JSON.`,
      temperature: 0.15,
      maxOutputTokens: 2500,
      requireJson: true,
    });

    const cleaned = cleanJsonString(rawText);
    const parsed = JSON.parse(cleaned);

    const validation = validateAndRepairWorkflow(parsed, preferences as WorkflowPreferences);

    return NextResponse.json({
      workflow: validation.repairedWorkflow,
      validation,
      nodeCount: validation.repairedWorkflow.nodes.length,
      modelUsed,
      autoRecovered,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to refine workflow';
    const isAuth = isAuthError(msg);

    return NextResponse.json(
      { error: isAuth ? 'Invalid or expired API key. Provider rejected authentication.' : msg },
      { status: isAuth ? 401 : 500 }
    );
  }
}

