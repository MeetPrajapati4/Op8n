import fs from 'node:fs';
import path from 'node:path';
import {
  encryptSecret,
  decryptSecret,
  getSafeLast4,
  EncryptedPayload,
} from './crypto';
import { PROVIDER_REGISTRY } from '../registry/providers';

export interface ProviderRecord {
  provider: string;
  encryptedKey: EncryptedPayload;
  last4: string;
  baseUrl?: string;
  updatedAt: string;
  defaultModel?: string;
}

export interface ProviderMetadataItem {
  provider: string;
  name: string;
  configured: boolean;
  last4?: string;
  baseUrl?: string;
  updatedAt?: string;
  defaultModel?: string;
}

interface EncryptedStoreFile {
  version: number;
  envelope: EncryptedPayload;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'keys.enc');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Loads and decrypts the entire key store file from disk.
 * Returns a map of provider -> ProviderRecord.
 */
function readStoreFromDisk(): Record<string, ProviderRecord> {
  ensureDataDir();

  if (!fs.existsSync(STORE_PATH)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    if (!raw.trim()) {
      return {};
    }

    const fileJson: EncryptedStoreFile = JSON.parse(raw);
    if (!fileJson.envelope) {
      return {};
    }

    const decryptedJsonStr = decryptSecret(fileJson.envelope);
    const parsed = JSON.parse(decryptedJsonStr);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('[Op8n KeyStore] Error reading or decrypting key store at rest:', err);
    // If decryption fails due to key change, avoid crashing but log securely
    return {};
  }
}

/**
 * Encrypts and saves the key store map to disk.
 */
function writeStoreToDisk(records: Record<string, ProviderRecord>): void {
  ensureDataDir();

  const serialized = JSON.stringify(records);
  const envelope = encryptSecret(serialized);

  const filePayload: EncryptedStoreFile = {
    version: 1,
    envelope,
  };

  // Write atomically via temporary file
  const tmpPath = `${STORE_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(filePayload, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(tmpPath, STORE_PATH);
}

/**
 * Returns metadata for all registered providers.
 * NEVER returns the API key itself.
 */
export function getAllProvidersMetadata(): ProviderMetadataItem[] {
  const records = readStoreFromDisk();

  return Object.values(PROVIDER_REGISTRY).map((reg) => {
    const record = records[reg.id];
    if (record) {
      return {
        provider: reg.id,
        name: reg.name,
        configured: true,
        last4: record.last4,
        baseUrl: record.baseUrl,
        updatedAt: record.updatedAt,
        defaultModel: record.defaultModel || reg.defaultModel,
      };
    }

    return {
      provider: reg.id,
      name: reg.name,
      configured: false,
      baseUrl: reg.baseUrl,
      defaultModel: reg.defaultModel,
    };
  });
}

/**
 * Server-only: retrieves and decrypts the provider's API key.
 * Never send this result to the browser.
 */
export function getDecryptedProviderKey(provider: string): {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  last4: string;
} | null {
  const records = readStoreFromDisk();
  const record = records[provider];
  if (!record || !record.encryptedKey) {
    return null;
  }

  try {
    const apiKey = decryptSecret(record.encryptedKey);
    return {
      apiKey,
      baseUrl: record.baseUrl,
      defaultModel: record.defaultModel,
      last4: record.last4,
    };
  } catch (err) {
    console.error(`[Op8n KeyStore] Failed to decrypt key for provider: ${provider}`);
    return null;
  }
}

/**
 * Encrypts and stores a provider API key.
 */
export function saveProviderKey(
  provider: string,
  apiKey: string,
  baseUrl?: string
): void {
  const reg = PROVIDER_REGISTRY[provider];
  if (!reg) {
    throw new Error(`Invalid provider id: ${provider}`);
  }

  const records = readStoreFromDisk();
  const encryptedKey = encryptSecret(apiKey);
  const last4 = getSafeLast4(apiKey);

  const existing = records[provider];

  records[provider] = {
    provider,
    encryptedKey,
    last4,
    baseUrl: baseUrl?.trim() || (existing ? existing.baseUrl : reg.baseUrl),
    updatedAt: new Date().toISOString(),
    defaultModel: existing?.defaultModel || reg.defaultModel,
  };

  writeStoreToDisk(records);
}

/**
 * Removes a provider key from storage.
 */
export function deleteProviderKey(provider: string): boolean {
  const records = readStoreFromDisk();
  if (records[provider]) {
    delete records[provider];
    writeStoreToDisk(records);
    return true;
  }
  return false;
}

/**
 * Sets the default model for a provider.
 */
export function setDefaultModelForProvider(provider: string, defaultModel: string): boolean {
  const records = readStoreFromDisk();
  if (records[provider]) {
    records[provider].defaultModel = defaultModel;
    records[provider].updatedAt = new Date().toISOString();
    writeStoreToDisk(records);
    return true;
  }
  return false;
}
