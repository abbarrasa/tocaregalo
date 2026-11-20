export const notificationBatchSize = 20;
export const notificationLeaseMs = 120_000;
export const notificationRetryBaseMs = 60_000;

export type NotificationId = Readonly<{ eventId: string; accountId: string }>;
export type NotificationLease = NotificationId & Readonly<{ token: string; failedAttempts: number }>;
export type DrawNotificationMessage = Readonly<{ eventId: string; email: string }>;
