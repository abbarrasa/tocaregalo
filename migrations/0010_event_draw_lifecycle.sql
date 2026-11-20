-- Rebuild the draw tables together to remove the old one-draw-per-event constraint.
-- Copy encrypted bytes unchanged: their authentication binds to the original draw IDs.
CREATE TABLE draws_next (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at_ms INTEGER NOT NULL,
  membership_revision INTEGER NOT NULL DEFAULT -1
) STRICT;
-- statement-breakpoint
CREATE TABLE draw_participants_next (
  draw_id TEXT NOT NULL REFERENCES draws_next(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  PRIMARY KEY (draw_id, member_id)
) STRICT;
-- statement-breakpoint
CREATE TABLE assignments_next (
  draw_id TEXT NOT NULL,
  giver_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  ciphertext BLOB NOT NULL CHECK (length(ciphertext) >= 16),
  recipient_index BLOB NOT NULL CHECK (length(recipient_index) = 32),
  PRIMARY KEY (draw_id, giver_id),
  UNIQUE (draw_id, key_id, recipient_index),
  FOREIGN KEY (draw_id, giver_id) REFERENCES draw_participants_next(draw_id, member_id) ON DELETE CASCADE
) STRICT;
-- statement-breakpoint
INSERT INTO draws_next (id, event_id, created_at_ms) SELECT id, event_id, created_at_ms FROM draws;
-- statement-breakpoint
INSERT INTO draw_participants_next SELECT * FROM draw_participants;
-- statement-breakpoint
INSERT INTO assignments_next SELECT * FROM assignments;
-- statement-breakpoint
DROP TABLE assignments;
-- statement-breakpoint
DROP TABLE draw_participants;
-- statement-breakpoint
DROP TABLE draws;
-- statement-breakpoint
ALTER TABLE draws_next RENAME TO draws;
-- statement-breakpoint
ALTER TABLE draw_participants_next RENAME TO draw_participants;
-- statement-breakpoint
ALTER TABLE assignments_next RENAME TO assignments;
-- statement-breakpoint
CREATE UNIQUE INDEX draws_event_revision ON draws(event_id, membership_revision);
-- statement-breakpoint
ALTER TABLE groups ADD COLUMN membership_revision INTEGER NOT NULL DEFAULT 0
  CHECK (membership_revision BETWEEN 0 AND 9007199254740991);
-- statement-breakpoint
ALTER TABLE events ADD COLUMN closed_at_ms INTEGER;
-- statement-breakpoint
ALTER TABLE events ADD COLUMN current_draw_id TEXT REFERENCES draws(id);
-- statement-breakpoint
ALTER TABLE events ADD COLUMN draw_membership_revision INTEGER;
-- statement-breakpoint
ALTER TABLE events ADD COLUMN redraw_required INTEGER NOT NULL DEFAULT 0 CHECK (redraw_required IN (0, 1));
-- statement-breakpoint
-- Adopt only legacy snapshots that exactly match today's group; keep all others as history.
UPDATE events SET current_draw_id = (SELECT id FROM draws WHERE event_id = events.id),
  draw_membership_revision = 0
WHERE group_id IS NOT NULL AND EXISTS (SELECT 1 FROM draws d WHERE d.event_id = events.id
  AND (SELECT count(*) FROM draw_participants p WHERE p.draw_id = d.id) >= 3
  AND (SELECT count(*) FROM assignments a WHERE a.draw_id = d.id) =
    (SELECT count(*) FROM draw_participants p WHERE p.draw_id = d.id)
  AND NOT EXISTS (SELECT member_id FROM draw_participants WHERE draw_id = d.id
    EXCEPT SELECT account_id FROM group_members WHERE group_id = events.group_id)
  AND NOT EXISTS (SELECT account_id FROM group_members WHERE group_id = events.group_id
    EXCEPT SELECT member_id FROM draw_participants WHERE draw_id = d.id));
-- statement-breakpoint
UPDATE draws SET membership_revision = 0 WHERE id IN (SELECT current_draw_id FROM events);
-- statement-breakpoint
CREATE INDEX events_pending_redraw ON events(group_id, id) WHERE closed_at_ms IS NULL AND redraw_required = 1;
-- statement-breakpoint
CREATE TRIGGER membership_added AFTER INSERT ON group_members BEGIN
  UPDATE groups SET membership_revision = membership_revision + 1 WHERE id = NEW.group_id;
END;
-- statement-breakpoint
CREATE TRIGGER membership_removed AFTER DELETE ON group_members BEGIN
  UPDATE groups SET membership_revision = membership_revision + 1 WHERE id = OLD.group_id;
  UPDATE events SET redraw_required = 1 WHERE group_id = OLD.group_id AND closed_at_ms IS NULL;
END;
-- statement-breakpoint
CREATE TRIGGER membership_identity_immutable BEFORE UPDATE OF group_id, account_id ON group_members
WHEN NEW.group_id IS NOT OLD.group_id OR NEW.account_id IS NOT OLD.account_id BEGIN
  SELECT RAISE(ABORT, 'Membership identity is immutable');
END;
-- statement-breakpoint
CREATE TRIGGER event_closed_immutable BEFORE UPDATE ON events
WHEN OLD.closed_at_ms IS NOT NULL AND
  (NEW.closed_at_ms IS NOT OLD.closed_at_ms OR NEW.current_draw_id IS NOT OLD.current_draw_id
    OR NEW.draw_membership_revision IS NOT OLD.draw_membership_revision OR NEW.group_id IS NOT OLD.group_id) BEGIN
  SELECT RAISE(ABORT, 'Closed event snapshot is immutable');
END;
