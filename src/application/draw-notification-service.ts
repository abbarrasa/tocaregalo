import { notificationLeaseMs, notificationRetryBaseMs, type DrawNotificationMessage, type NotificationId, type NotificationLease } from '../domain/draw-notifications.ts';
import { nextDeliveryAt } from '../domain/timing.ts';
import { requireTimestamp } from '../domain/validation.ts';

export interface DrawNotificationStore {
  due(nowMs: number): Promise<NotificationId[]>;
  claim(id: NotificationId, token: string, nowMs: number, expiresAtMs: number): Promise<NotificationLease | null>;
  message(lease: NotificationLease, nowMs: number): Promise<DrawNotificationMessage | null>;
  accept(lease: NotificationLease, nowMs: number): Promise<void>;
  fail(lease: NotificationLease, failedAttempts: number, nextAtMs: number | null, nowMs: number): Promise<void>;
}
export interface DrawNotificationSender { send(message: DrawNotificationMessage): Promise<void> }

export class DrawNotificationService {
  private readonly store: DrawNotificationStore;
  private readonly sender: DrawNotificationSender;
  private readonly now: () => number;
  constructor(store: DrawNotificationStore, sender: DrawNotificationSender, now = Date.now) {
    this.store = store; this.sender = sender; this.now = now;
  }

  async run() {
    const nowMs = this.now(); requireTimestamp(nowMs);
    const ids = await this.store.due(nowMs);
    const report = { accepted: 0, failed: 0, skipped: 0 };
    for (const id of ids) {
      const claimedAt = this.now(); requireTimestamp(claimedAt);
      const expiresAt = claimedAt + notificationLeaseMs; requireTimestamp(expiresAt);
      // Claim immediately before each send, not the whole batch in advance.
      const lease = await this.store.claim(id, crypto.randomUUID(), claimedAt, expiresAt);
      if (!lease) { report.skipped++; continue; }
      const message = await this.store.message(lease, this.now());
      if (!message) { report.skipped++; continue; }
      try { await this.sender.send(message); }
      catch {
        const failedAt = this.now();
        const attempts = lease.failedAttempts + 1;
        await this.store.fail(lease, attempts, nextDeliveryAt(attempts, failedAt, notificationRetryBaseMs), failedAt);
        report.failed++; continue;
      }
      // An acknowledgement failure must propagate, never be recorded as a failed send.
      // The expired lease can later be recovered, with the documented duplicate risk.
      await this.store.accept(lease, this.now()); report.accepted++;
    }
    return report;
  }
}
