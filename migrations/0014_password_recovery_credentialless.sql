-- A recovery challenge may belong to a verified or credentialless account.
-- Credential creation is atomic with challenge consumption and revokes all sessions.
ALTER TABLE password_recoveries RENAME TO password_recoveries_legacy;
CREATE TABLE password_recoveries (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  credential_revision INTEGER NOT NULL CHECK (credential_revision >= 0),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
  consumption_id TEXT
) STRICT;
INSERT INTO password_recoveries
  (account_id, email, credential_revision, token_hash, created_at_ms, expires_at_ms, consumption_id)
SELECT p.account_id, p.email, p.credential_revision, p.token_hash, p.created_at_ms, p.expires_at_ms, p.consumption_id
FROM password_recoveries_legacy p
JOIN password_credentials c ON c.account_id = p.account_id AND c.revision = p.credential_revision;
DROP TABLE password_recoveries_legacy;
CREATE INDEX password_recoveries_by_expiry ON password_recoveries(expires_at_ms);
