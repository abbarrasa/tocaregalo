-- Read-only aggregates. A sending row's available time is its lease expiry.
WITH clock AS (SELECT CAST(unixepoch('now') AS INTEGER) * 1000 AS now_ms)
SELECT status, count(*) AS total,
  sum(CASE WHEN status = 'pending' AND available_at_ms <= now_ms THEN 1 ELSE 0 END) AS due,
  sum(CASE WHEN status = 'sending' AND available_at_ms <= now_ms THEN 1 ELSE 0 END) AS expired_leases,
  max(failed_attempts) AS maximum_known_failures,
  max(CASE WHEN status IN ('pending', 'sending') THEN max(0, now_ms - created_at_ms) ELSE NULL END) AS oldest_unsettled_age_ms
FROM draw_notifications CROSS JOIN clock GROUP BY status ORDER BY status;
