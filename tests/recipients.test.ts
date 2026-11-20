import assert from 'node:assert/strict';
import test from 'node:test';
import { RecipientService, type RecipientSelection, type RecipientStore } from '../src/application/recipient-service.ts';
import { encryptRecipient } from '../src/domain/recipient-protection.ts';
import { loadRecipientDecryptionKey, loadRecipientKey, RecipientKeyUnavailable } from '../src/infrastructure/recipient-key.ts';

const active = { DRAW_KEY_ID: 'active', DRAW_CIPHER_KEY_HEX: '01'.repeat(32), DRAW_INDEX_KEY_HEX: '02'.repeat(32) };

test('private reads use decrypt-only active and retained keys without needing historical HMAC keys', async () => {
  const old = { DRAW_KEY_ID: 'old', DRAW_CIPHER_KEY_HEX: '03'.repeat(32), DRAW_INDEX_KEY_HEX: '04'.repeat(32) };
  const settings = { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: JSON.stringify([{ id: 'old', cipherHex: old.DRAW_CIPHER_KEY_HEX }]) };
  for (const source of [active, old]) {
    const envelope = await encryptRecipient(await loadRecipientKey(source), { drawId: 'draw', giverId: 'actor' }, 'recipient');
    const key = await loadRecipientDecryptionKey(settings, source.DRAW_KEY_ID);
    assert.equal(key.cipher.extractable, false); assert.deepEqual(key.cipher.usages, ['decrypt']);
    const store: RecipientStore = {
      async select() { return { kind: 'ready', drawId: 'draw', envelope }; },
      async resolve(eventId, actor, drawId, recipientId) {
        assert.equal(eventId, 'event'); assert.equal(actor, 'actor'); assert.equal(drawId, 'draw'); assert.equal(recipientId, 'recipient');
        return { kind: 'ok', drawId, recipient: { accountId: recipientId, displayName: 'Recipient' } };
      },
    };
    const result = await new RecipientService(store, id => loadRecipientDecryptionKey(settings, id)).find('actor', 'event');
    assert.deepEqual(result, { kind: 'ok', drawId: 'draw', recipient: { accountId: 'recipient', displayName: 'Recipient' } });
  }
  const readOnly = await loadRecipientDecryptionKey({ DRAW_PREVIOUS_CIPHER_KEYS_JSON: settings.DRAW_PREVIOUS_CIPHER_KEYS_JSON }, 'old');
  assert.deepEqual(readOnly.cipher.usages, ['decrypt']);
});

test('unavailable, ambiguous or invalid key configuration fails without exposing secret material', async () => {
  for (const settings of [
    {}, { ...active, DRAW_CIPHER_KEY_HEX: 'private-invalid-value' },
    { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: '{private-invalid-json' },
    { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: '{}' },
    { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: '[null]' },
    { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: JSON.stringify([{ id: 'active', cipherHex: '03'.repeat(32) }]) },
    { ...active, DRAW_PREVIOUS_CIPHER_KEYS_JSON: JSON.stringify([{ id: 'old', cipherHex: '03'.repeat(32) }, { id: 'old', cipherHex: '04'.repeat(32) }]) },
  ]) {
    await assert.rejects(loadRecipientDecryptionKey(settings, 'active'), error => {
      assert.ok(error instanceof RecipientKeyUnavailable); assert.equal(error.message, 'Recipient key unavailable.'); return true;
    });
  }
  await assert.rejects(loadRecipientDecryptionKey(active, 'unknown'), RecipientKeyUnavailable);
});

test('unauthorized and pending reads do not load keys; access is rechecked after decrypting', async () => {
  let selection: RecipientSelection = { kind: 'not-found' }; let resolves = 0; let keys = 0;
  const key = await loadRecipientKey(active);
  let accessRevoked = false;
  const store: RecipientStore = {
    async select() { return selection; },
    async resolve() { assert.equal(accessRevoked, true); resolves++; return { kind: 'not-found' }; },
  };
  const service = new RecipientService(store, async id => {
    keys++; assert.equal(id, 'active'); accessRevoked = true; return loadRecipientDecryptionKey(active, id);
  });
  assert.deepEqual(await service.find('actor', 'event'), { kind: 'not-found' });
  selection = { kind: 'pending' }; assert.deepEqual(await service.find('actor', 'event'), { kind: 'pending' });
  assert.equal(keys, 0); assert.equal(resolves, 0);
  selection = { kind: 'ready', drawId: 'draw', envelope: await encryptRecipient(key, { drawId: 'draw', giverId: 'actor' }, 'recipient') };
  assert.deepEqual(await service.find('actor', 'event'), { kind: 'not-found' }); assert.equal(resolves, 1);
});

test('scope corruption and invalid decrypted recipients fail before profile lookup', async () => {
  const key = await loadRecipientKey(active);
  for (const [giverId, recipientId] of [['other', 'recipient'], ['actor', 'actor'], ['actor', ' ']]) {
    const envelope = await encryptRecipient(key, { drawId: 'draw', giverId }, recipientId);
    const store: RecipientStore = {
      async select() { return { kind: 'ready', drawId: 'draw', envelope }; },
      async resolve() { assert.fail('Do not resolve an invalid assignment'); },
    };
    await assert.rejects(new RecipientService(store, id => loadRecipientDecryptionKey(active, id)).find('actor', 'event'));
  }
});
