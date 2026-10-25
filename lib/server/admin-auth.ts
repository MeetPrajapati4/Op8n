import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  constantTimeCompare,
  signSessionPayload,
  verifySessionSignature,
} from './crypto';

export const ADMIN_COOKIE_NAME = 'op8n_admin_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
}

export function verifyAdminPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!configuredPassword) {
    return false;
  }
  return constantTimeCompare(password.trim(), configuredPassword);
}

export function generateAdminSessionToken(): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${expiresAt}.${nonce}`;
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
}

export function isValidAdminSessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 4) return false;

  const [issuedAtStr, expiresAtStr, nonce, signature] = parts;
  const payload = `${issuedAtStr}.${expiresAtStr}.${nonce}`;

  if (!verifySessionSignature(payload, signature)) {
    return false;
  }

  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  return true;
}

export function getAdminTokenFromRequest(req: Request | NextRequest): string | undefined {
  if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
    const cookie = (req as NextRequest).cookies.get(ADMIN_COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }

  // Fallback to cookie header parsing
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return undefined;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function verifyAdminSession(req: Request | NextRequest): boolean {
  const token = getAdminTokenFromRequest(req);
  return isValidAdminSessionToken(token);
}

export function applyAdminSessionCookie(response: NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}
