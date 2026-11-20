CREATE TABLE draw_notifications (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  created_at_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'accepted', 'failed', 'cancelled')),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 6),
  available_at_ms INTEGER NOT NULL,
  lease_token TEXT,
  accepted_at_ms INTEGER,
  CHECK ((status = 'sending' AND lease_token IS NOT NULL) OR (status <> 'sending' AND lease_token IS NULL)),
  PRIMARY KEY (event_id, account_id),
  FOREIGN KEY (draw_id, account_id) REFERENCES draw_participants(draw_id, member_id) ON DELETE CASCADE
) STRICT;
-- statement-breakpoint
CREATE INDEX draw_notifications_due ON draw_notifications(available_at_ms, event_id, account_id)
  WHERE status IN ('pending', 'sending');
-- statement-breakpoint
-- No historical backfill. Future manual and scheduled closes share this transaction.
CREATE TRIGGER enqueue_draw_notifications AFTER UPDATE OF closed_at_ms ON events
WHEN OLD.closed_at_ms IS NULL AND NEW.closed_at_ms IS NOT NULL AND NEW.current_draw_id IS NOT NULL BEGIN
  INSERT INTO draw_notifications (event_id, account_id, draw_id, created_at_ms, available_at_ms)
    SELECT NEW.id, p.member_id, NEW.current_draw_id, NEW.closed_at_ms, NEW.closed_at_ms
    FROM draw_participants p JOIN group_members m ON m.group_id = NEW.group_id AND m.account_id = p.member_id
    WHERE p.draw_id = NEW.current_draw_id
    ON CONFLICT (event_id, account_id) DO NOTHING;
END;
-- statement-breakpoint
CREATE TRIGGER cancel_removed_draw_notifications AFTER DELETE ON group_members BEGIN
  UPDATE draw_notifications SET status = 'cancelled', lease_token = NULL
    WHERE account_id = OLD.account_id AND status IN ('pending', 'sending')
    AND event_id IN (SELECT id FROM events WHERE group_id = OLD.group_id);
END;
