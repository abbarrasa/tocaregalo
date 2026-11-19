ALTER TABLE accounts ADD COLUMN email_verified_at_ms INTEGER;

-- One current challenge per account. Raw tokens are never stored.
CREATE TABLE email_verifications (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
  consumed_at_ms INTEGER,
  consumption_id TEXT,
  CHECK ((consumed_at_ms IS NULL) = (consumption_id IS NULL))
) STRICT;
CREATE INDEX email_verifications_by_expiry ON email_verifications(expires_at_ms);
