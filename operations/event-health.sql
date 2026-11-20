-- Read-only, one aggregate row per job kind. No event/account identities.
WITH clock AS (SELECT CAST(unixepoch('now') AS INTEGER) * 1000 AS now_ms),
jobs AS (
  SELECT j.kind, j.retry_stage, j.next_attempt_at_ms, e.closure_at_ms, e.redraw_required,
    (SELECT count(*) FROM (SELECT 1 FROM group_members m WHERE m.group_id = e.group_id LIMIT 3)) AS members
  FROM event_processing_jobs j JOIN events e ON e.id = j.event_id
  WHERE e.closed_at_ms IS NULL
)
SELECT kind, count(*) AS queued,
  sum(CASE WHEN next_attempt_at_ms <= now_ms AND members >= 3
    AND ((kind = 'close' AND closure_at_ms <= now_ms) OR (kind = 'redraw' AND redraw_required = 1))
    THEN 1 ELSE 0 END) AS runnable,
  sum(CASE WHEN members < 3 THEN 1 ELSE 0 END) AS undersized,
  sum(CASE WHEN retry_stage > 0 THEN 1 ELSE 0 END) AS backed_off,
  max(CASE WHEN kind = 'close' AND closure_at_ms <= now_ms
    THEN now_ms - closure_at_ms ELSE NULL END) AS oldest_closure_delay_ms
FROM jobs CROSS JOIN clock GROUP BY kind ORDER BY kind;
