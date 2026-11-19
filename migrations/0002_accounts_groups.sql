CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  owner_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  joined_at_ms INTEGER NOT NULL,
  PRIMARY KEY (group_id, account_id)
) STRICT;

CREATE INDEX group_members_by_account ON group_members(account_id, group_id);
CREATE INDEX groups_by_owner ON groups(owner_account_id);

-- Existing events remain unlinked and cannot be read through membership queries.
ALTER TABLE events ADD COLUMN group_id TEXT REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX events_by_group ON events(group_id);
