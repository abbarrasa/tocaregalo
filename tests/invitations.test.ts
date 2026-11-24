import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvitationToken, hashInvitationToken, invitationEmailInput, invitationLifetimeMs, invitationPageInput, invitationStatus } from '../src/domain/invitations.ts';
import { hashSessionToken } from '../src/domain/session.ts';
import { hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { hashPasswordRecoveryToken } from '../src/domain/password-recovery.ts';
import { AuthInputError } from '../src/domain/authentication.ts';
import { ResendInvitationSender } from '../src/infrastructure/resend-invitation-sender.ts';
import { InvitationService, InvitationDeliveryError, type InvitationStore } from '../src/application/invitation-service.ts';
import { InvitationManagementService, type InvitationManagementStore } from '../src/application/invitation-management-service.ts';

test('invitation tokens are random, purpose-separated and addressed with normalized email', async () => {
  const token = createInvitationToken();
  assert.notEqual(token, createInvitationToken());
  const hash = await hashInvitationToken(token);
  assert.notEqual(hash, token);
  for (const other of [hashSessionToken, hashEmailVerificationToken, hashPasswordRecoveryToken]) assert.notEqual(hash, await other(token));
  assert.equal(invitationLifetimeMs, 604800000);
  assert.equal(invitationEmailInput({ email: ' Alice@EXAMPLE.TEST ' }), 'alice@example.test');
  for (const value of [null, [], {}, { email: 1 }, { email: 'invalid' }]) assert.throws(() => invitationEmailInput(value), AuthInputError);
});

test('invitation use case authorizes before quotas and invalidates only the failed token', async () => {
  let owner = false;
  let allowed = true;
  let quotaCalls = 0;
  let issuedHash = '';
  let invalidated = '';
  const store: InvitationStore = {
    async isOwner() { return owner; },
    async issue(group, actor, email, hash, created, expires) {
      assert.equal(group, 'group'); assert.equal(actor, 'owner'); assert.equal(email, 'alice@example.test');
      assert.equal(created, 1000); assert.equal(expires, 1000 + invitationLifetimeMs);
      issuedHash = hash; return { groupName: 'Friends' };
    },
    async invalidate(hash) { invalidated = hash; },
    async consume() { return false; },
  };
  const service = new InvitationService(store, { async send() { throw new Error('provider details'); } }, {
    async allowInvitation() { quotaCalls++; return allowed; },
  }, () => 1000);
  assert.equal(await service.request('owner', 'group', 'Alice@example.test'), 'not-found');
  assert.equal(quotaCalls, 0);
  owner = true; allowed = false;
  assert.equal(await service.request('owner', 'group', 'Alice@example.test'), 'limited');
  assert.equal(issuedHash, '');
  allowed = true;
  await assert.rejects(service.request('owner', 'group', 'Alice@example.test'), InvitationDeliveryError);
  assert.equal(invalidated, issuedHash);
});

test('invitation sender uses distinct text, stored group context and tracking-free transport', async () => {
  const token = createInvitationToken();
  const sender = new ResendInvitationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' }, async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init?.redirect, 'manual');
    assert.ok(typeof init?.body === 'string');
    assert.ok(init.body.includes('Friends'));
    assert.ok(init.body.includes(token));
    assert.ok(init.body.includes('recipient@example.test'));
    assert.equal(init.body.includes('enable_text":true'), false);
    return new Response(null, { status: 202 });
  });
  await sender.send({ email: 'recipient@example.test', groupName: 'Friends', token, expiresAtMs: 604800000 });
});

test('invitation administration validates email cursors and derives states at the expiry boundary', () => {
  assert.equal(invitationStatus(false, 1000, 999), 'pending');
  assert.equal(invitationStatus(false, 1000, 1000), 'expired');
  assert.equal(invitationStatus(true, 1000, 2000), 'accepted');
  assert.deepEqual(invitationPageInput(null, null), { limit: 20, cursor: null });
  assert.deepEqual(invitationPageInput('50', ' A@EXAMPLE.TEST '), { limit: 50, cursor: 'a@example.test' });
  for (const size of ['0', '51', '1.5', '01']) assert.throws(() => invitationPageInput(size, null), AuthInputError);
  for (const cursor of ['', 'invalid', 'x'.repeat(513)]) assert.throws(() => invitationPageInput(null, cursor), AuthInputError);
});

test('management service keeps inaccessible and empty results distinct and emits a bounded page', async () => {
  const store: InvitationManagementStore = {
    async listForOwner(group, actor, limit, after) {
      if (actor !== 'owner') return null;
      if (group === 'empty') return [];
      assert.equal(limit, 2); assert.equal(after, null);
      return [
        { email: 'a@example.test', createdAtMs: 0, expiresAtMs: 1000, accepted: false },
        { email: 'b@example.test', createdAtMs: 0, expiresAtMs: 2000, accepted: false },
      ];
    },
    async revokeForOwner(group, actor, email, now) {
      assert.equal(group, 'group'); assert.equal(email, 'a@example.test'); assert.equal(now, 1000);
      return actor === 'owner';
    },
  };
  const service = new InvitationManagementService(store, () => 1000);
  assert.equal(await service.list('other', 'group', { limit: 1, cursor: null }), null);
  assert.deepEqual(await service.list('owner', 'empty', { limit: 1, cursor: null }), { invitations: [], nextCursor: null });
  assert.deepEqual(await service.list('owner', 'group', { limit: 1, cursor: null }), {
    invitations: [{ email: 'a@example.test', createdAtMs: 0, expiresAtMs: 1000, status: 'expired' }], nextCursor: 'a@example.test',
  });
  assert.equal(await service.revoke('owner', 'group', ' A@EXAMPLE.TEST '), true);
});
