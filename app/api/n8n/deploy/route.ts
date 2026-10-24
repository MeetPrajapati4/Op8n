import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const deployInputSchema = z.object({
  n8nUrl: z.string().url('Must be a valid URL'),
  apiKey: z.string().min(1, 'n8n API Key is required'),
  workflow: z.object({
    name: z.string(),
    nodes: z.array(z.unknown()),
    connections: z.record(z.string(), z.unknown()),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
    return true;
  }

  // AWS/Cloud metadata service IP
  if (lower === '169.254.169.254') return true;

  // Check RFC 1918 private IPv4 addresses: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  const ipParts = lower.split('.').map(Number);
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (ipParts[0] === 10) return true;
    if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
    if (ipParts[0] === 192 && ipParts[1] === 168) return true;
    if (ipParts[0] === 127) return true;
    if (ipParts[0] === 169 && ipParts[1] === 254) return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parseResult = deployInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { n8nUrl, apiKey, workflow } = parseResult.data;

  // SSRF Protection
  let urlObj: URL;
  try {
    urlObj = new URL(n8nUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid n8n URL format' }, { status: 400 });
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http and https protocols are allowed' }, { status: 400 });
  }

  const allowLocal = process.env.ALLOW_LOCAL_N8N === 'true';
  if (!allowLocal && isPrivateIpOrHost(urlObj.hostname)) {
    return NextResponse.json(
      {
        error:
          'Security Error: Connecting to private/loopback network addresses is disabled. Set ALLOW_LOCAL_N8N=true in .env.local to permit local instances.',
      },
      { status: 403 }
    );
  }

  const targetApiUrl = `${urlObj.origin}/api/v1/workflows`;

  try {
    const res = await fetch(targetApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey,
      },
      body: JSON.stringify({
        name: workflow.name || 'Op8n Generated Workflow',
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings || {},
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `n8n responded with status ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const workflowId = data.id || data.data?.id;
    const workflowUrl = workflowId ? `${urlObj.origin}/workflow/${workflowId}` : urlObj.origin;

    return NextResponse.json({
      success: true,
      workflowId,
      workflowUrl,
      message: 'Workflow successfully created in your n8n instance!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach n8n instance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
