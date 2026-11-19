import { createInvitationToken, hashInvitationToken, invitationLifetimeMs, isInvitationToken } from '../domain/invitations.ts';
import { normalizeEmail } from '../domain/authentication.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface InvitationStore {
  isOwner(groupId: string, actorAccountId: string): Promise<boolean>;
  issue(groupId: string, actorAccountId: string, email: string, tokenHash: string, createdAtMs: number, expiresAtMs: number): Promise<{ groupName: string } | null>;
  invalidate(tokenHash: string): Promise<void>;
  consume(tokenHash: string, actorAccountId: string, nowMs: number): Promise<boolean>;
}
export type InvitationMessage = Readonly<{ email: string; groupName: string; token: string; expiresAtMs: number }>;
export interface InvitationSender { send(message: InvitationMessage): Promise<void> }
export interface InvitationLimiter { allowInvitation(ownerId: string, groupId: string, email: string): Promise<boolean> }

export class InvitationDeliveryError extends Error {
  constructor() { super('Invitation delivery unavailable.'); this.name = 'InvitationDeliveryError'; }
}

export class InvitationService {
  private readonly store: InvitationStore;
  private readonly sender: InvitationSender;
  private readonly limiter: InvitationLimiter;
  private readonly now: () => number;
  constructor(store: InvitationStore, sender: InvitationSender, limiter: InvitationLimiter, now = Date.now) {
    this.store = store; this.sender = sender; this.limiter = limiter; this.now = now;
  }

  async request(actorAccountId: string, groupId: string, email: string): Promise<'sent' | 'not-found' | 'limited'> {
    const recipient = normalizeEmail(email);
    // Non-owners must not be able to exhaust a group's recipient quota.
    if (!await this.store.isOwner(groupId, actorAccountId)) return 'not-found';
    if (!await this.limiter.allowInvitation(actorAccountId, groupId, recipient)) return 'limited';
    const createdAtMs = this.now();
    const expiresAtMs = createdAtMs + invitationLifetimeMs;
    requireTimestamp(createdAtMs); requireTimestamp(expiresAtMs);
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    // Recheck ownership in the write itself, even after the quota preflight.
    const target = await this.store.issue(groupId, actorAccountId, recipient, tokenHash, createdAtMs, expiresAtMs);
    if (!target) return 'not-found';
    try { await this.sender.send({ email: recipient, groupName: target.groupName, token, expiresAtMs }); }
    catch { await this.store.invalidate(tokenHash); throw new InvitationDeliveryError(); }
    return 'sent';
  }

  async accept(actorAccountId: string, token: string): Promise<boolean> {
    if (!isInvitationToken(token)) return false;
    const nowMs = this.now(); requireTimestamp(nowMs);
    return this.store.consume(await hashInvitationToken(token), actorAccountId, nowMs);
  }
}
