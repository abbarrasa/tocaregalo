import type { RecipientKey } from '../domain/recipient-protection.ts';

export class RecipientKeyUnavailable extends Error {
  constructor() { super('Recipient encryption unavailable.'); this.name = 'RecipientKeyUnavailable'; }
}

export interface RecipientKeySettings {
  DRAW_KEY_ID?: string;
  DRAW_CIPHER_KEY_HEX?: string;
  DRAW_INDEX_KEY_HEX?: string;
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
