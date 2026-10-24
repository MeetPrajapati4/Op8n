import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { validateAndRepairWorkflow } from '@/lib/validator';
import { DEFAULT_PREFERENCES, WorkflowPreferences } from '@/lib/settings';

const refineInputSchema = z.object({
  existingWorkflow: z.record(z.string(), z.unknown()),
  instruction: z.string().min(3).max(2000),
  preferences: z.record(z.string(), z.unknown()).optional(),
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return NextResponse.json(
      { error: 'Server GEMINI_API_KEY is not configured.' },
      { status: 500 }
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

  const { existingWorkflow, instruction, preferences = DEFAULT_PREFERENCES } = parseResult.data;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
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

    const prompt = `${SYSTEM_PROMPT}

You are refining an EXISTING n8n workflow.
Existing Workflow JSON:
${JSON.stringify(existingWorkflow, null, 2)}

User Refinement Request:
"${instruction.trim()}"

Modify the workflow according to the user request. Keep existing node names and structure where possible, add or modify nodes as requested, update connection mappings properly.
Output ONLY the updated valid n8n workflow JSON.`;

    const result = await model.generateContent(prompt);
    const cleaned = cleanJsonString(result.response.text());
    const parsed = JSON.parse(cleaned);

    const validation = validateAndRepairWorkflow(parsed, preferences as WorkflowPreferences);

    return NextResponse.json({
      workflow: validation.repairedWorkflow,
      validation,
      nodeCount: validation.repairedWorkflow.nodes.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to refine workflow';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
