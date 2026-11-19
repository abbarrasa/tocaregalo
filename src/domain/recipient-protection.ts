const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const ivBytes = 12;

export type AssignmentScope = Readonly<{ drawId: string; giverId: string }>;
export type RecipientEnvelope = Readonly<{
  keyId: string;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  recipientIndex: ArrayBuffer;
}>;
export type RecipientKey = Readonly<{
  id: string;
  cipher: CryptoKey;
  index: CryptoKey;
}>;

function scopeBytes(scope: AssignmentScope, keyId: string): Uint8Array {
  return encoder.encode(JSON.stringify(['tocaregalo/recipient/v1', keyId, scope.drawId, scope.giverId]));
}

export async function recipientIndex(
  key: RecipientKey,
  drawId: string,
  recipientId: string,
): Promise<ArrayBuffer> {
  const input = encoder.encode(JSON.stringify(['tocaregalo/recipient-index/v1', key.id, drawId, recipientId]));
  return crypto.subtle.sign('HMAC', key.index, input);
}

export async function encryptRecipient(
  key: RecipientKey,
  scope: AssignmentScope,
  recipientId: string,
): Promise<RecipientEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
  const [ciphertext, index] = await Promise.all([
    crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: scopeBytes(scope, key.id) },
      key.cipher,
      encoder.encode(recipientId),
    ),
    recipientIndex(key, scope.drawId, recipientId),
  ]);
  return { keyId: key.id, iv, ciphertext, recipientIndex: index };
}

export async function decryptRecipient(
  keys: ReadonlyMap<string, RecipientKey>,
  scope: AssignmentScope,
  envelope: RecipientEnvelope,
): Promise<string> {
  const key = keys.get(envelope.keyId);
  if (!key || key.id !== envelope.keyId) throw new Error('Recipient key unavailable.');
  if (envelope.iv.byteLength !== ivBytes) throw new Error('Invalid recipient envelope.');

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: envelope.iv, additionalData: scopeBytes(scope, key.id) },
    key.cipher,
    envelope.ciphertext,
  );
  return decoder.decode(plaintext);
}
