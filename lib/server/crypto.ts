import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Parses and validates the master encryption key from SETTINGS_ENCRYPTION_KEY.
 * Must resolve to exactly 32 bytes (256 bits).
 * Supports 64 hex characters, 44 base64 characters, or 32 UTF-8 characters.
 * Fails with a clear error if missing or invalid.
 */
export function getMasterEncryptionKey(): Buffer {
  const rawKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error(
      '[Op8n Security] SETTINGS_ENCRYPTION_KEY environment variable is missing. ' +
      'Please configure a 32-byte key. Generate one with: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  let keyBuffer: Buffer;

  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'hex');
  } else if (rawKey.length === 44 && /^[A-Za-z0-9+/=]+$/.test(rawKey)) {
    keyBuffer = Buffer.from(rawKey, 'base64');
  } else if (Buffer.byteLength(rawKey, 'utf8') === 32) {
    keyBuffer = Buffer.from(rawKey, 'utf8');
  } else {
    throw new Error(
      `[Op8n Security] SETTINGS_ENCRYPTION_KEY is invalid length (${rawKey.length} chars). ` +
      'Must be exactly 32 bytes (64 hex characters or 32 UTF-8 characters). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `[Op8n Security] SETTINGS_ENCRYPTION_KEY resolved to ${keyBuffer.length} bytes instead of 32 bytes.`
    );
  }

  return keyBuffer;
}

export interface EncryptedPayload {
  iv: string; // hex
  authTag: string; // hex
  ciphertext: string; // hex
}

/**
 * Encrypts a plaintext secret using AES-256-GCM with a fresh random IV.
 */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const masterKey = getMasterEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    authTag,
    ciphertext,
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 * Validates the authentication tag to guarantee integrity.
 */
export function decryptSecret(payload: EncryptedPayload): string {
  const masterKey = getMasterEncryptionKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Extracts the last 4 characters of an API key safely.
 * Returns up to 4 characters or 'xxxx' if shorter.
 */
export function getSafeLast4(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') return 'none';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}

/**
 * Redacts Authorization, API keys, and secret tokens from headers before logging or returning.
 */
export function redactSensitiveHeaders(
  headers: Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveNames = [
    'authorization',
    'x-api-key',
    'x-goog-api-key',
    'api-key',
    'cookie',
    'set-cookie',
  ];

  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    if (sensitiveNames.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates a generic safe error message for client responses, ensuring no sensitive credentials
 * or stack details leak.
 */
export function sanitizeClientError(error: unknown, fallbackMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    const msg = error.message;
    // Known safe error messages that don't leak secrets
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key')) {
      return 'Provider authentication failed: Invalid API key';
    }
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return 'Provider rate limit exceeded. Please wait a moment.';
    }
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      return 'Provider access denied. Check your API key permissions.';
    }
    if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
      return 'Provider endpoint or model not found.';
    }
    if (msg.toLowerCase().includes('enotfound') || msg.toLowerCase().includes('fetch failed')) {
      return 'Network error connecting to provider. Please verify connectivity or base URL.';
    }
  }

  return fallbackMessage;
}

/**
 * Compares two strings using constant-time comparison to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * HMAC-SHA256 signature for admin session tokens.
 */
export function signSessionPayload(payloadStr: string): string {
  const masterKey = getMasterEncryptionKey();
  return crypto.createHmac('sha256', masterKey).update(payloadStr).digest('hex');
}

/**
 * Verifies HMAC-SHA256 signature for admin session tokens.
 */
export function verifySessionSignature(payloadStr: string, signature: string): boolean {
  const expectedSignature = signSessionPayload(payloadStr);
  return constantTimeCompare(expectedSignature, signature);
}
