-- Timestamps are UTC epoch milliseconds. Recipients are never stored in clear text.
CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  closure_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE draws (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  created_at_ms INTEGER NOT NULL
) STRICT;

-- Snapshot of the participants at draw time, including the owner.
CREATE TABLE draw_participants (
  draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  PRIMARY KEY (draw_id, member_id)
) STRICT;

CREATE TABLE assignments (
  draw_id TEXT NOT NULL,
  giver_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  ciphertext BLOB NOT NULL CHECK (length(ciphertext) >= 16),
  recipient_index BLOB NOT NULL CHECK (length(recipient_index) = 32),
  PRIMARY KEY (draw_id, giver_id),
  UNIQUE (draw_id, key_id, recipient_index),
  FOREIGN KEY (draw_id, giver_id)
    REFERENCES draw_participants(draw_id, member_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX events_closure_due ON events(closure_at_ms)
  WHERE closure_at_ms IS NOT NULL;
