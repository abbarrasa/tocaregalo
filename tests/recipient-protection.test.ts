import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptRecipient, encryptRecipient, recipientIndex } from '../src/domain/recipient-protection.ts';

async function createKey(id: string) {
  const [cipher, index] = await Promise.all([
    crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
    crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']),
  ]);
  return { id, cipher, index };
}

test('recipient encryption authenticates the draw and giver and supports key rotation', async () => {
  const old = await createKey('old');
  const current = await createKey('current');
  const keyring = new Map([[old.id, old], [current.id, current]]);
  const scope = { drawId: 'draw-1', giverId: 'giver-1' };
  const envelope = await encryptRecipient(old, scope, 'recipient-2');
  const repeated = await encryptRecipient(old, scope, 'recipient-2');

  assert.notDeepEqual(envelope.iv, repeated.iv);
  assert.notDeepEqual(envelope.ciphertext, repeated.ciphertext);
  assert.equal(await decryptRecipient(keyring, scope, envelope), 'recipient-2');
  await assert.rejects(decryptRecipient(keyring, { ...scope, giverId: 'giver-2' }, envelope));
  await assert.rejects(decryptRecipient(keyring, { ...scope, drawId: 'draw-2' }, envelope));
  await assert.rejects(decryptRecipient(new Map([[current.id, current]]), scope, envelope));

  const tampered = envelope.ciphertext.slice(0);
  new Uint8Array(tampered)[0] ^= 1;
  await assert.rejects(decryptRecipient(keyring, scope, { ...envelope, ciphertext: tampered }));
});

test('recipient deletion index matches within one draw and differs across draws', async () => {
  const key = await createKey('v1');
  const id = 'recipient-2';
  const scope = { drawId: 'draw-1', giverId: 'giver-1' };
  const envelope = await encryptRecipient(key, scope, id);
  assert.deepEqual(envelope.recipientIndex, await recipientIndex(key, scope.drawId, id));
  assert.notDeepEqual(envelope.recipientIndex, await recipientIndex(key, 'draw-2', id));
  assert.notDeepEqual(envelope.recipientIndex, await recipientIndex(key, scope.drawId, 'recipient-3'));
});
