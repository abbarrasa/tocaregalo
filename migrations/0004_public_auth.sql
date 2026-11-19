ALTER TABLE accounts ADD COLUMN last_name TEXT;
ALTER TABLE accounts ADD COLUMN phone TEXT;
CREATE UNIQUE INDEX accounts_unique_phone ON accounts(phone) WHERE phone IS NOT NULL;

-- Existing accounts intentionally receive no password credential.
CREATE TABLE password_credentials (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
) STRICT;

-- Fixed-window counters contain hashes of rate-limit keys, not raw identifiers.
CREATE TABLE auth_rate_limits (
  key_hash TEXT PRIMARY KEY NOT NULL,
  window_start_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
) STRICT;
CREATE INDEX auth_rate_limits_by_window ON auth_rate_limits(window_start_ms);
