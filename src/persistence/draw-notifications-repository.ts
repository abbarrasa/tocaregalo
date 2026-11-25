import type { DrawNotificationStore } from '../application/draw-notification-service.ts';
import { notificationBatchSize, type DrawNotificationMessage, type NotificationId, type NotificationLease } from '../domain/draw-notifications.ts';
import type { PersistenceDatabase } from './d1.ts';

export class DrawNotificationsRepository implements DrawNotificationStore {
  private readonly db: PersistenceDatabase;
  constructor(db: PersistenceDatabase) { this.db = db; }

  async due(nowMs: number): Promise<NotificationId[]> {
    return (await this.db.prepare(`SELECT event_id AS eventId, account_id AS accountId FROM draw_notifications
      WHERE status IN ('pending', 'sending') AND available_at_ms <= ? AND failed_attempts < 6
      ORDER BY available_at_ms, event_id, account_id LIMIT ?`).bind(nowMs, notificationBatchSize).all<NotificationId>()).results;
  }

  async claim(id: NotificationId, token: string, nowMs: number, expiresAtMs: number): Promise<NotificationLease | null> {
    return this.db.prepare(`UPDATE draw_notifications SET status = 'sending', lease_token = ?, available_at_ms = ?
      WHERE event_id = ? AND account_id = ? AND status IN ('pending', 'sending')
      AND available_at_ms <= ? AND failed_attempts < 6
      AND EXISTS (SELECT 1 FROM events e JOIN group_members m ON m.group_id = e.group_id
        WHERE e.id = draw_notifications.event_id AND m.account_id = draw_notifications.account_id
        AND e.closed_at_ms IS NOT NULL AND e.current_draw_id = draw_notifications.draw_id)
      RETURNING event_id AS eventId, account_id AS accountId, lease_token AS token, failed_attempts AS failedAttempts`)
      .bind(token, expiresAtMs, id.eventId, id.accountId, nowMs).first<NotificationLease>();
  }

  async message(lease: NotificationLease, nowMs: number): Promise<DrawNotificationMessage | null> {
    return this.db.prepare(`SELECT n.event_id AS eventId, a.email FROM draw_notifications n
      JOIN events e ON e.id = n.event_id JOIN group_members m ON m.group_id = e.group_id AND m.account_id = n.account_id
      JOIN accounts a ON a.id = n.account_id
      WHERE n.event_id = ? AND n.account_id = ? AND n.status = 'sending' AND n.lease_token = ?
      AND n.available_at_ms > ? AND e.closed_at_ms IS NOT NULL AND e.current_draw_id = n.draw_id`)
      .bind(lease.eventId, lease.accountId, lease.token, nowMs).first<DrawNotificationMessage>();
  }

  async accept(lease: NotificationLease, nowMs: number): Promise<void> {
    await this.db.prepare(`UPDATE draw_notifications SET status = 'accepted', lease_token = NULL, accepted_at_ms = ?
      WHERE event_id = ? AND account_id = ? AND status = 'sending' AND lease_token = ?`)
      .bind(nowMs, lease.eventId, lease.accountId, lease.token).first();
  }

  async fail(lease: NotificationLease, failedAttempts: number, nextAtMs: number | null, nowMs: number): Promise<void> {
    await this.db.prepare(`UPDATE draw_notifications SET status = ?, lease_token = NULL, failed_attempts = ?, available_at_ms = ?
      WHERE event_id = ? AND account_id = ? AND status = 'sending' AND lease_token = ?`)
      .bind(nextAtMs === null ? 'failed' : 'pending', failedAttempts, nextAtMs ?? nowMs,
        lease.eventId, lease.accountId, lease.token).first();
  }
}
