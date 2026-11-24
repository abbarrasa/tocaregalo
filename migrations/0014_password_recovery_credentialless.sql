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
FROM password_recoveries_legacy p;

CREATE TABLE password_recovery_migration_quarantine (
  account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  credential_revision INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumption_id TEXT,
  quarantine_reason TEXT NOT NULL
) STRICT;

-- Keep unmatched/obsolete legacy challenges auditable instead of silently losing them.
INSERT INTO password_recovery_migration_quarantine
  (account_id, email, credential_revision, token_hash, created_at_ms, expires_at_ms, consumption_id, quarantine_reason)
SELECT p.account_id, p.email, p.credential_revision, p.token_hash, p.created_at_ms, p.expires_at_ms, p.consumption_id,
  'missing-account-or-stale-credential-revision'
FROM password_recoveries_legacy p
LEFT JOIN accounts a ON a.id = p.account_id
LEFT JOIN password_credentials c ON c.account_id = p.account_id AND c.revision = p.credential_revision
WHERE a.id IS NULL OR c.account_id IS NULL;
DROP TABLE password_recoveries_legacy;
CREATE INDEX password_recoveries_by_expiry ON password_recoveries(expires_at_ms);
