import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  verifyAdminPassword,
  generateAdminSessionToken,
  applyAdminSessionCookie,
  clearAdminSessionCookie,
  verifyAdminSession,
  isAdminPasswordConfigured,
} from '@/lib/server/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limiter';

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export async function GET(req: NextRequest) {
  const authenticated = verifyAdminSession(req);
  return NextResponse.json({
    authenticated,
    configured: isAdminPasswordConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 'admin-auth', 10, 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please wait a minute.' },
      { status: 429 }
    );
  }

  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured in server environment.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { password } = parsed.data;
  const isMatch = verifyAdminPassword(password);

  if (!isMatch) {
    return NextResponse.json(
      { error: 'Invalid admin password' },
      { status: 401 }
    );
  }

  const token = generateAdminSessionToken();
  const response = NextResponse.json({ ok: true, message: 'Admin authenticated' });
  applyAdminSessionCookie(response, token);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  clearAdminSessionCookie(response);
  return response;
}
