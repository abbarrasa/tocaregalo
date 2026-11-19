import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvitationToken, hashInvitationToken, invitationEmailInput, invitationLifetimeMs } from '../src/domain/invitations.ts';
import { hashSessionToken } from '../src/domain/session.ts';
import { hashEmailVerificationToken } from '../src/domain/email-verification.ts';
import { hashPasswordRecoveryToken } from '../src/domain/password-recovery.ts';
import { AuthInputError } from '../src/domain/authentication.ts';
import { SendgridInvitationSender } from '../src/infrastructure/sendgrid-invitation-sender.ts';
import { InvitationService, InvitationDeliveryError, type InvitationStore } from '../src/application/invitation-service.ts';

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
  const sender = new SendgridInvitationSender({ apiKey: 'synthetic-key', fromEmail: 'sender@example.test' }, async (url, init) => {
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
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
