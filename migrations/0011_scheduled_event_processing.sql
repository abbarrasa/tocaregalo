CREATE TABLE event_processing_jobs (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('close', 'redraw')),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version BETWEEN 0 AND 9007199254740991),
  retry_stage INTEGER NOT NULL DEFAULT 0 CHECK (retry_stage BETWEEN 0 AND 5),
  next_attempt_at_ms INTEGER NOT NULL CHECK (next_attempt_at_ms BETWEEN -9007199254740991 AND 9007199254740991),
  PRIMARY KEY (event_id, kind)
) STRICT;
-- statement-breakpoint
CREATE INDEX event_processing_due ON event_processing_jobs(kind, next_attempt_at_ms, event_id);
-- statement-breakpoint
INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms)
  SELECT id, 'close', closure_at_ms FROM events
  WHERE closed_at_ms IS NULL AND group_id IS NOT NULL AND closure_at_ms IS NOT NULL;
-- statement-breakpoint
INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms)
  SELECT id, 'redraw', 0 FROM events
  WHERE closed_at_ms IS NULL AND group_id IS NOT NULL AND redraw_required = 1;
-- statement-breakpoint
CREATE TRIGGER event_processing_created AFTER INSERT ON events
WHEN NEW.closed_at_ms IS NULL AND NEW.group_id IS NOT NULL AND NEW.closure_at_ms IS NOT NULL BEGIN
  INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms) VALUES (NEW.id, 'close', NEW.closure_at_ms);
END;
-- statement-breakpoint
-- Existing membership triggers still advance revisions and mark open events.
-- These triggers do not depend on their relative execution order.
CREATE TRIGGER event_processing_member_added AFTER INSERT ON group_members BEGIN
  UPDATE event_processing_jobs SET version = version + 1, retry_stage = 0,
    next_attempt_at_ms = CASE kind WHEN 'close' THEN
      (SELECT closure_at_ms FROM events WHERE id = event_id) ELSE 0 END
    WHERE retry_stage > 0
      AND event_id IN (SELECT id FROM events WHERE group_id = NEW.group_id AND closed_at_ms IS NULL);
END;
-- statement-breakpoint
CREATE TRIGGER event_processing_member_removed AFTER DELETE ON group_members BEGIN
  INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms)
    SELECT id, 'redraw', 0 FROM events WHERE group_id = OLD.group_id AND closed_at_ms IS NULL
    ON CONFLICT (event_id, kind) DO UPDATE SET version = version + 1, retry_stage = 0, next_attempt_at_ms = 0;
  UPDATE event_processing_jobs SET version = version + 1, retry_stage = 0,
    next_attempt_at_ms = (SELECT closure_at_ms FROM events WHERE id = event_id)
    WHERE kind = 'close' AND retry_stage > 0 AND event_id IN
      (SELECT id FROM events WHERE group_id = OLD.group_id AND closed_at_ms IS NULL);
END;
-- statement-breakpoint
CREATE TRIGGER event_processing_completed AFTER UPDATE OF closed_at_ms, redraw_required ON events BEGIN
  DELETE FROM event_processing_jobs WHERE event_id = NEW.id
    AND (NEW.closed_at_ms IS NOT NULL OR (kind = 'redraw' AND NEW.redraw_required = 0));
END;
-- statement-breakpoint
CREATE TRIGGER event_processing_rescheduled AFTER UPDATE OF closure_at_ms ON events
WHEN NEW.closed_at_ms IS NULL BEGIN
  DELETE FROM event_processing_jobs WHERE event_id = NEW.id AND kind = 'close'
    AND (NEW.closure_at_ms IS NULL OR NEW.group_id IS NULL);
  INSERT INTO event_processing_jobs (event_id, kind, next_attempt_at_ms)
    SELECT NEW.id, 'close', NEW.closure_at_ms WHERE NEW.closure_at_ms IS NOT NULL AND NEW.group_id IS NOT NULL
    ON CONFLICT (event_id, kind) DO UPDATE SET version = version + 1, retry_stage = 0, next_attempt_at_ms = excluded.next_attempt_at_ms;
END;
