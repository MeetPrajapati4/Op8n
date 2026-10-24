import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

const explainInputSchema = z
  .object({
    workflowJson: z.union([z.string().min(5), z.record(z.string(), z.unknown())]).optional(),
    workflow: z.union([z.string().min(5), z.record(z.string(), z.unknown())]).optional(),
  })
  .refine((data) => data.workflowJson || data.workflow, {
    message: 'Either workflowJson or workflow is required',
  });

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
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parseResult = explainInputSchema.safeParse(body);
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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 0,
        },
        maxOutputTokens: 2500,
      } as any,
    });

    const prompt = `You are an expert n8n workflow architect and security auditor.
Analyze this n8n workflow JSON and return a JSON object with this exact schema:

{
  "title": "Short descriptive name",
  "summary": "1-2 sentence executive summary of what this automation accomplishes",
  "trigger": "Name and explanation of the trigger mechanism",
  "steps": [
    { "node": "Node Name", "role": "What this node does in the flow" }
  ],
  "securityFindings": [
    { "level": "info|warning|critical", "message": "Security or credential finding" }
  ],
  "reliabilityFindings": [
    { "level": "info|warning|critical", "message": "Error handling, retry, or rate limiting note" }
  ],
  "recommendations": [
    "Actionable tip to improve efficiency or resilience"
  ]
}

Workflow JSON to analyze:
${workflowString}`;

    const res = await model.generateContent(prompt);
    const cleaned = res.response
      .text()
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    const analysis = JSON.parse(cleaned);
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
