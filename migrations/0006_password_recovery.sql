-- One current recovery challenge per credential-bearing account, with no raw tokens.
ALTER TABLE password_credentials ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE TABLE password_recoveries (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES password_credentials(account_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  credential_revision INTEGER NOT NULL CHECK (credential_revision >= 0),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
  consumption_id TEXT
) STRICT;
CREATE INDEX password_recoveries_by_expiry ON password_recoveries(expires_at_ms);
