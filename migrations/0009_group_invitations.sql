-- One current invitation per group and normalized email, without storing raw tokens.
CREATE TABLE group_invitations (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(trim(email))),
  inviter_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
  consumption_id TEXT,
  PRIMARY KEY (group_id, email)
) STRICT;
CREATE INDEX group_invitations_by_expiry ON group_invitations(expires_at_ms);
