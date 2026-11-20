import type { RecipientDecryptionKey, RecipientKey } from '../domain/recipient-protection.ts';

export class RecipientKeyUnavailable extends Error {
  constructor() { super('Recipient key unavailable.'); this.name = 'RecipientKeyUnavailable'; }
}

export interface RecipientKeySettings {
  DRAW_KEY_ID?: string;
  DRAW_CIPHER_KEY_HEX?: string;
  DRAW_INDEX_KEY_HEX?: string;
  DRAW_PREVIOUS_CIPHER_KEYS_JSON?: string;
}

// Read keys need only AES-GCM decryption, never HMAC signing or encryption rights.
export async function loadRecipientDecryptionKey(settings: RecipientKeySettings, id: string): Promise<RecipientDecryptionKey> {
  const keys = new Map<string, string>();
  const add = (keyId: unknown, cipherHex: unknown) => {
    if (typeof keyId !== 'string' || !keyId.trim() || typeof cipherHex !== 'string'
      || !/^[a-fA-F0-9]{64}$/.test(cipherHex) || keys.has(keyId)) throw new RecipientKeyUnavailable();
    keys.set(keyId, cipherHex);
  };
  if (settings.DRAW_KEY_ID !== undefined || settings.DRAW_CIPHER_KEY_HEX !== undefined) {
    add(settings.DRAW_KEY_ID, settings.DRAW_CIPHER_KEY_HEX);
  }
  if (settings.DRAW_PREVIOUS_CIPHER_KEYS_JSON !== undefined) {
    let previous: unknown;
    try { previous = JSON.parse(settings.DRAW_PREVIOUS_CIPHER_KEYS_JSON); }
    catch (error) { if (error instanceof SyntaxError) throw new RecipientKeyUnavailable(); throw error; }
    if (!Array.isArray(previous)) throw new RecipientKeyUnavailable();
    for (const value of previous) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RecipientKeyUnavailable();
      add(value.id, value.cipherHex);
    }
  }
  const hex = keys.get(id);
  if (!hex) throw new RecipientKeyUnavailable();
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], value => Number.parseInt(value, 16));
  try {
    return { id, cipher: await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['decrypt']) };
  } finally { bytes.fill(0); }
}

export async function loadRecipientKey(settings: RecipientKeySettings): Promise<RecipientKey> {
  const { DRAW_KEY_ID: id, DRAW_CIPHER_KEY_HEX: cipherHex, DRAW_INDEX_KEY_HEX: indexHex } = settings;
  if (!id?.trim() || !cipherHex || !indexHex || !/^[a-fA-F0-9]{64}$/.test(cipherHex)
    || !/^[a-fA-F0-9]{64}$/.test(indexHex) || cipherHex.toLowerCase() === indexHex.toLowerCase()) {
    throw new RecipientKeyUnavailable();
  }
  const cipherBytes = Uint8Array.from(cipherHex.match(/../g) ?? [], hex => Number.parseInt(hex, 16));
  const indexBytes = Uint8Array.from(indexHex.match(/../g) ?? [], hex => Number.parseInt(hex, 16));
  try {
    const [cipher, index] = await Promise.all([
      crypto.subtle.importKey('raw', cipherBytes, 'AES-GCM', false, ['encrypt']),
      crypto.subtle.importKey('raw', indexBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    ]);
    return { id, cipher, index };
  } finally { cipherBytes.fill(0); indexBytes.fill(0); }
}
