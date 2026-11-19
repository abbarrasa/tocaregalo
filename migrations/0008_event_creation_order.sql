-- Keyset order: newest creation time first, then descending ID for tied timestamps.
CREATE INDEX events_by_group_creation ON events(group_id, created_at_ms DESC, id DESC);

-- statement-breakpoint

-- Preserve all historical timestamps and prevent later changes to them.
CREATE TRIGGER events_creation_time_immutable
BEFORE UPDATE OF created_at_ms ON events
WHEN NEW.created_at_ms IS NOT OLD.created_at_ms
BEGIN
  SELECT RAISE(ABORT, 'Event creation time is immutable');
END;
